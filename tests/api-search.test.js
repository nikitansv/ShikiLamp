jest.mock('../src/api/client', () => ({ request: jest.fn() }));
const client = require('../src/api/client');
const api = require('../src/api');
const normalizer = require('../src/api/normalizer');
const config = require('../src/config');
const previousLampa = global.Lampa;

afterEach(() => { client.request.mockReset(); global.Lampa = previousLampa; });

test('numeric search returns a list while getById returns a single anime', async () => {
  client.request.mockResolvedValue({ data: { animes: [{ id: '42', name: 'Fixture' }] } });
  expect(await api.search('42')).toEqual([expect.objectContaining({ shikimori_id: 42 })]);
  expect(await api.getById(42)).toEqual(expect.objectContaining({ shikimori_id: 42 }));
  client.request.mockResolvedValue({ data: { animes: [] } });
  expect(await api.search('999999')).toEqual([]);
  expect(await api.getById(999999)).toBeNull();
});

test('display language switches immediately without changing title aliases', () => {
  let language = 'russian';
  global.Lampa = { Storage: { get: (key, fallback) => key === config.STORAGE_KEYS.language ? language : fallback } };
  const source = { id: '1', russian: 'Агент времени', english: ['Link Click'], name: 'Shiguang Dailiren' };
  const russian = normalizer.normalizeAnime(source);
  expect(russian.title).toBe('Агент времени');
  language = 'english';
  const english = normalizer.normalizeAnime(source);
  expect(english.title).toBe('Link Click');
  expect(english.aliases).toEqual(russian.aliases);
  expect(normalizer.normalizeAnime({ id: '2', english: [], name: 'Original' }).title).toBe('Original');
});

test('REST catalog enriches canonical posters without changing filter order', async () => {
  client.request.mockResolvedValueOnce([
    { id: 2, name: 'Second', image: { preview: '/assets/globals/missing_preview.jpg' } },
    { id: 1, name: 'First' }
  ]).mockResolvedValueOnce({ data: { animes: [
    { id: 1, name: 'First', poster: { mainUrl: '/uploads/first.webp' } },
    { id: 2, name: 'Second', poster: { mainUrl: '/uploads/second.webp' } }
  ] } });
  const result = await api.catalog({ status: 'ongoing', order: 'aired_on' }, { scope: 'catalog-posters' });
  expect(result.map(anime => anime.shikimori_id)).toEqual([2, 1]);
  expect(result[0].poster).toBe('https://shikimori.io/uploads/second.webp');
  expect(client.request.mock.calls[0][0]).toContain('status=ongoing');
  expect(client.request.mock.calls[1][1]).toMatchObject({ scope: 'catalog-posters' });
});

test('poster enrichment keeps REST data on network failure but propagates cancellation', async () => {
  client.request.mockRejectedValueOnce(new Error('Temporary failure'));
  const list = [{ shikimori_id: 1, title: 'Keep data', rate_id: 42 }];
  expect(await api.hydrateAnimeDetails(list)).toEqual(list);
  const error = Object.assign(new Error('REQUEST_CANCELLED'), { code: 'REQUEST_CANCELLED' });
  client.request.mockRejectedValueOnce(error);
  await expect(api.hydrateAnimeDetails(list)).rejects.toBe(error);
});
