const scoring = require('../src/mapping/scoring');

describe('mapping/scoring', () => {
  test('exact title match between anime and candidate', () => {
    const anime = { title: 'Naruto', original_title: 'Naruto', russian_title: 'Наруто', year: 2002, kind: 'tv', episodes: 220, aliases: [] };
    const candidate = { name: 'Naruto', original_name: 'Naruto', russian_title: '', year: 2002, media_type: 'tv', episodes: 220 };
    expect(scoring.score(anime, candidate)).toBeGreaterThan(0.9);
  });

  test('completely different titles score low', () => {
    const anime = { title: 'Naruto', original_title: 'Naruto', aliases: [] };
    const candidate = { name: 'One Piece', original_name: 'One Piece' };
    expect(scoring.score(anime, candidate)).toBeLessThan(0.5);
  });

  test('kind matches correctly', () => {
    expect(scoring.kindMatches('tv', 'tv')).toBe(true);
    expect(scoring.kindMatches('movie', 'movie')).toBe(true);
    expect(scoring.kindMatches('ova', 'tv')).toBe(true);
  });

  test('episode score works', () => {
    expect(scoring.episodeScore(12, 12)).toBe(1);
    expect(scoring.episodeScore(12, 24)).toBeLessThan(1);
  });
});
