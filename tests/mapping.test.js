const matcher = require('../src/mapping/matcher');
const storage = require('../src/mapping/storage');

describe('mapping/matcher', () => {
  beforeEach(() => storage.clear());

  test('returns local mapping', () => {
    const anime = { shikimori_id: 42, title: 'Naruto', original_title: 'Naruto', mal_id: 42, year: 2002, kind: 'tv', episodes: 220, aliases: [] };
    storage.set({ shikimori_id: 42, tmdb_id: 101, tmdb_type: 'tv', tmdb_season: 1, confidence: 1.0, verified: true });
    return matcher.findBest(anime).then(function (out) {
      expect(out.result).toBeTruthy();
      expect(out.result.tmdb_id).toBe(101);
    });
  });

  test('builds lampa card object', () => {
    const anime = { shikimori_id: 1, mal_id: 1, title: 'Frieren', original_title: 'Sousou no Frieren', year: 2023, description: '', score: 9, poster: 'http://x' };
    const card = matcher.buildLampaCard(anime, { tmdb_id: 5, tmdb_type: 'tv', tmdb_season: 1, episode_offset: 0, confidence: 0.95 }, 'tv');
    expect(card.id).toBe(5);
    expect(card.method).toBe('tv');
    expect(card.shikimori_id).toBe(1);
  });
});
