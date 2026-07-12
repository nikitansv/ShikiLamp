const normalizer = require('../src/api/normalizer');

describe('api/normalizer', () => {
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

  test('gets MAL id fallback', () => {
    expect(normalizer.getMalId({ malId: 123 })).toBe(123);
    expect(normalizer.getMalId({ myanimelist_id: 456 })).toBe(456);
  });
});
