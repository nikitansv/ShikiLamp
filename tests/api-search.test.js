jest.mock('../src/api/client', () => ({ request: jest.fn() }));
const client = require('../src/api/client');
const api = require('../src/api');
const normalizer = require('../src/api/normalizer');
const config = require('../src/config');
const previousLampa = global.Lampa;

afterEach(() => { jest.clearAllMocks(); global.Lampa = previousLampa; });

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
