jest.mock('../src/api/client', () => ({ request: jest.fn(() => Promise.resolve([])) }));

const client = require('../src/api/client');
const userApi = require('../src/api/user');

beforeEach(() => client.request.mockClear());

describe('user api normalization', () => {
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

  test('keeps only current anime and removes duplicates across lists', async () => {
    client.request
      .mockResolvedValueOnce([
        { id: 1, name: 'Current', status: 'ongoing', episodes: 12, episodes_aired: 5 },
        { id: 2, name: 'Not started', status: 'anons', episodes: 12, episodes_aired: 0 }
      ])
      .mockResolvedValueOnce([
        { id: 1, name: 'Current', status: 'ongoing', episodes: 12, episodes_aired: 5 },
        { id: 3, name: 'Finished', status: 'released', episodes: 12, episodes_aired: 12 }
      ]);

    const list = await userApi.listCurrentAnimeRates(1, 1, 20);
    expect(list.map(anime => anime.shikimori_id)).toEqual([1]);
  });

  test('matches Shikimori ongoing status even with zero aired episodes', () => {
    expect(userApi.isCurrentlyAiring({ status: 'ongoing', episodes: 12, episodes_aired: 0 })).toBe(true);
    expect(userApi.isCurrentlyAiring({ status: 'released', episodes: 12, episodes_aired: 11 })).toBe(false);
  });
});
