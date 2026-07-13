const userApi = require('../src/api/user');

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
});
