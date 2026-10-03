const normalizer = require('../src/api/normalizer');

describe('api/normalizer', () => {
  test('keeps alternate poster URLs and normalizes relative or protocol-relative images', () => {
    const anime = normalizer.normalizeAnime({ id: 1, poster: { mainUrl: '/main.webp', mainAltUrl: '//cdn.example/alternate.jpg', originalUrl: '/original.webp' }, image: { original: '/legacy.jpg' } });
    expect(anime.poster).toBe('https://shikimori.io/main.webp');
    expect(anime.poster_fallbacks).toEqual(['https://shikimori.io/main.webp', 'https://cdn.example/alternate.jpg', 'https://shikimori.io/original.webp', 'https://shikimori.io/legacy.jpg']);
    expect(normalizer.normalizeAnime({ id: 1, poster: {}, image: { preview: '/legacy.jpg' } }).poster).toBe('https://shikimori.io/legacy.jpg');
  });
  test('REST English title arrays produce a text title, including empty arrays', () => {
    expect(normalizer.normalizeAnime({ id: 1, name: 'Name', english: ['English'] }).title).toBe('English');
    expect(normalizer.normalizeAnime({ id: 1, name: 'Name', english: [] }).title).toBe('Name');
  });

  test('REST images preserve absolute URLs and missing images stay empty', () => {
    expect(normalizer.normalizeAnime({ id: 1, image: { original: 'https://cdn.example/poster.jpg' } }).poster).toBe('https://cdn.example/poster.jpg');
    expect(normalizer.normalizeAnime({ id: 1, image: {} }).poster).toBe('');
  });
  test('normalizes anime', () => {
    const item = {
      id: 1,
      name: 'Attack on Titan',
      russian: 'Атака титанов',
      image: { preview: '/poster.jpg' }
    };
    const out = normalizer.normalizeAnime(item);
    expect(out.shikimori_id).toBe(1);
    expect(out.title).toBe('Атака титанов');
    expect(out.poster).toContain('poster.jpg');
  });

  test('normalizes list safely', () => {
    expect(normalizer.normalizeList(null)).toEqual([]);
    expect(normalizer.normalizeList([{ id: 2, name: 'X' }]).length).toBe(1);
  });

  test('extracts year from airedOn', () => {
    expect(normalizer.getYear({ airedOn: { year: 2020 } })).toBe(2020);
  });

  test('preserves full release date', () => {
    const anime = normalizer.normalizeAnime({ id: 3, name: 'Date', aired_on: '2025-10-04' });
    expect(anime.release_date).toBe('2025-10-04');
  });

  test('normalizes REST aired episode count', () => {
    const anime = normalizer.normalizeAnime({ id: 4, name: 'Episodes', episodes: 12, episodes_aired: 5 });
    expect(anime.episodes_aired).toBe(5);
  });

  test('gets MAL id fallback', () => {
    expect(normalizer.getMalId({ malId: 123 })).toBe(123);
    expect(normalizer.getMalId({ myanimelist_id: 456 })).toBe(456);
  });
});
