jest.mock('../src/api/client', () => ({ request: jest.fn(() => Promise.resolve([])) }));

const client = require('../src/api/client');
const userApi = require('../src/api/user');

beforeEach(() => client.request.mockReset().mockResolvedValue([]));

describe('user api normalization', () => {
  test('home and filtered personal lists replace REST placeholders with canonical GraphQL posters', async () => {
    const options = { scope: 'personal-posters' };
    client.request.mockResolvedValueOnce([
      { id: 58749, name: 'Arknights', image: { preview: '/assets/globals/missing_preview.jpg' } },
      { id: 53881, name: 'Older', image: { preview: '/system/animes/preview/53881.jpg' } }
    ]).mockResolvedValueOnce({ data: { animes: [
      { id: 53881, name: 'Older', poster: { mainUrl: 'https://shikimori.io/uploads/older.webp' } },
      { id: 58749, name: 'Arknights', poster: { mainUrl: 'https://shikimori.io/uploads/arknights.webp', mainAltUrl: 'https://shikimori.io/uploads/arknights.jpeg' } }
    ] } });
    const result = await userApi.listCurrentAnimeRates(1, 1, 20, options);
    expect(result.map(anime => anime.shikimori_id)).toEqual([58749, 53881]);
    expect(result[0].poster).toBe('https://shikimori.io/uploads/arknights.webp');
    expect(result[0].poster_fallbacks).toContain('https://shikimori.io/uploads/arknights.jpeg');
    expect(client.request.mock.calls[1][1]).toMatchObject(options);
    expect(client.request.mock.calls[1][1].body.variables.ids).toBe('58749,53881');
  });

  test('mutation responses use target_id as anime ID, keeping watched episodes separate', () => {
    expect(userApi.normalizeRate({ id: 42, target_id: 1, target_type: 'Anime', episodes: 3, score: 8 })).toMatchObject({
      shikimori_id: 1, rate_id: 42, episodes: 0, score: 0, user_episodes: 3, user_score: 8
    });
  });

  test('detail hydration preserves server list order and user progress', async () => {
    const rates = userApi.normalizeRates([{ id: 42, episodes: 3, anime: { id: 2 } }, { id: 43, anime: { id: 1 } }]);
    client.request.mockResolvedValueOnce({ data: { animes: [{ id: 1, name: 'First' }, { id: 2, name: 'Second' }] } });
    const result = await userApi.hydrateAnimeDetails(rates);
    expect(result.map(anime => anime.shikimori_id)).toEqual([2, 1]);
    expect(result[0]).toMatchObject({ title: 'Second', rate_id: 42, user_episodes: 3 });
  });

  test('detail hydration propagates cancellation', async () => {
    const error = Object.assign(new Error('REQUEST_CANCELLED'), { code: 'REQUEST_CANCELLED' });
    client.request.mockRejectedValueOnce(error);
    await expect(userApi.hydrateAnimeDetails([{ shikimori_id: 1 }])).rejects.toBe(error);
  });

  test('detail hydration cannot return an old user list after logout', async () => {
    let complete;
    client.request.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const pending = userApi.hydrateAnimeDetails([{ shikimori_id: 1 }]);
    await Promise.resolve();
    require('../src/auth').clearToken();
    complete({ data: { animes: [{ id: 1, name: 'Name' }] } });
    await expect(pending).rejects.toThrow('AUTH_SESSION_CHANGED');
  });
  test('normalizes anime rates with embedded anime', () => {
    const list = userApi.normalizeRates([
      {
        id: 42,
        status: 'planned',
        score: 8,
        episodes: 3,
        anime: {
          id: 1,
          name: 'Sousou no Frieren',
          russian: 'Провожающая в последний путь Фрирен',
          kind: 'tv',
          score: '9.1',
          aired_on: '2023-09-29',
          image: { preview: '/system/animes/preview/1.jpg' }
        }
      }
    ]);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      shikimori_id: 1,
      title: 'Провожающая в последний путь Фрирен',
      rate_id: 42,
      user_rate_status: 'planned',
      user_score: 8,
      user_episodes: 3
    });
  });

  test('sorts planned and watching by release date', async () => {
    await userApi.listAnimeRates(1, 'planned', 1, 20);
    expect(client.request.mock.calls[0][0]).toContain('order=aired_on');

    await userApi.listAnimeRates(1, 'watching', 1, 20);
    expect(client.request.mock.calls[1][0]).toContain('order=aired_on');
  });

  test('keeps other lists sorted by last update', async () => {
    await userApi.listAnimeRates(1, 'completed', 1, 20);
    expect(client.request.mock.calls[0][0]).toContain('order=updated_at');
  });

  test('loads planned list in 100-item pages', async () => {
    await userApi.listAllAnimeRates(1, 'planned');
    expect(client.request.mock.calls[0][0]).toContain('limit=100');
    expect(client.request.mock.calls[0][0]).toContain('page=1');
  });

  test('uses Shikimori site filter for planned and watching ongoing anime', async () => {
    client.request.mockResolvedValueOnce([
      { id: 1, name: 'Current', status: 'ongoing', episodes: 12, episodes_aired: 5 }
    ]);
    const list = await userApi.listCurrentAnimeRates(1, 1, 20);
    expect(list.map(anime => anime.shikimori_id)).toEqual([1]);
    expect(client.request.mock.calls[0][0]).toContain('status=ongoing');
    expect(client.request.mock.calls[0][0]).toContain('mylist=planned%2Cwatching');
    expect(client.request.mock.calls[0][0]).toContain('order=aired_on');
  });

  test.each(['ongoing', 'released', 'anons'])('planned %s keeps release-date ordering on every page', async status => {
    await userApi.listMyListAnimes('planned', status, 1, 50);
    await userApi.listMyListAnimes('planned', status, 2, 50);
    const urls = client.request.mock.calls.map(call => call[0]);
    expect(urls[0]).toContain('page=1');
    expect(urls[1]).toContain('page=2');
    urls.forEach(url => {
      expect(url).toContain('mylist=planned');
      expect(url).toContain('order=aired_on');
      expect(url).toContain('status=' + status);
    });
  });

  test('ongoing catalog requests newest releases on later pages too', () => {
    const query = require('../src/api/graphql').ongoingAnimes(20, 2);
    expect(query.query).toContain('order: aired_on');
    expect(query.variables.page).toBe(2);
  });

  test('matches active seasons by aired episode count', () => {
    expect(userApi.isCurrentlyAiring({ status: 'ongoing', episodes: 12, episodes_aired: 0 })).toBe(false);
    expect(userApi.isCurrentlyAiring({ status: 'released', episodes: 12, episodes_aired: 11 })).toBe(true);
    expect(userApi.isCurrentlyAiring({ status: 'ongoing', episodes: 12, episodes_aired: 12 })).toBe(false);
  });
});
