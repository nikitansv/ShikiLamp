const config = require('../src/config');
const originalLampa = global.Lampa;
let matcher;
let storage;
let data;
let search;

function anime(id = 1, title = 'Example Anime') {
  return { shikimori_id: id, title, original_title: title, kind: 'tv', year: 2020, episodes: 12, poster: 'original' };
}
function result(title = 'Example Anime') {
  return { tv: { results: [{ id: 10, name: title, original_name: title, first_air_date: '2020-01-01', poster_path: '/poster.jpg' }] } };
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  data = {};
  search = jest.fn();
  global.Lampa = { Api: { search }, Storage: {
    get: (key, fallback) => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback,
    set: (key, value) => { data[key] = value; }
  }, TMDB: { api: path => 'https://tmdb.example/' + path } };
  matcher = require('../src/mapping/matcher');
  storage = require('../src/mapping/storage');
});

afterEach(async () => {
  await jest.runAllTimersAsync();
  jest.useRealTimers();
  global.Lampa = originalLampa;
});

test('shares in-flight searches while allowing at most three active callbacks', async () => {
  const pending = [1, 2, 3, 4, 5].map(id => matcher.findBest(anime(id, 'Title ' + String.fromCharCode(64 + id))));
  const duplicate = matcher.findBest(anime(1, 'Title A'));
  expect(search).toHaveBeenCalledTimes(3);
  search.mock.calls[0][1](result('Title A'));
  expect(search).toHaveBeenCalledTimes(4);
  search.mock.calls[1][1](result('Title B'));
  expect(search).toHaveBeenCalledTimes(5);
  search.mock.calls.slice(2).forEach(call => call[1](result(call[0].query)));
  const values = await Promise.all(pending);
  expect(await duplicate).toEqual(values[0]);
});

test('deadline rejects a stalled search and allows retry, ignoring late responses', async () => {
  const first = matcher.findBest(anime());
  const rejected = expect(first).rejects.toThrow('TMDB search unavailable');
  await jest.advanceTimersByTimeAsync(12000);
  await rejected;
  const retry = matcher.findBest(anime());
  expect(search).toHaveBeenCalledTimes(2);
  search.mock.calls[0][1](result('Wrong stale title'));
  search.mock.calls[1][1](result());
  expect((await retry).candidates[0].item.name).toBe('Example Anime');
});

test('cached candidates obey changed thresholds and do not replace posters below confidence', async () => {
  search.mockImplementation((params, done) => done(result()));
  data[config.STORAGE_KEYS.mappingThreshold] = 1;
  const item = anime();
  expect((await matcher.findBest(item)).result).toBeNull();
  await matcher.applyBestPoster(item);
  expect(item.poster).toBe('original');
  data[config.STORAGE_KEYS.mappingThreshold] = 0.5;
  await matcher.applyBestPoster(item);
  expect(item.poster).toContain('/poster.jpg');
  expect(search).toHaveBeenCalledTimes(1);
});

test('manual mapping wins even when an in-flight search fails', async () => {
  const item = anime();
  const pending = matcher.findBest(item);
  matcher.saveManual(item, 99, 'movie', 1, 0);
  search.mock.calls[0][2]();
  await expect(pending).resolves.toMatchObject({ source: 'local', result: { tmdb_id: 99 } });
});

test('late poster response cannot overwrite a replacement manual mapping', async () => {
  const item = anime();
  storage.set({ shikimori_id: 1, tmdb_id: 10, tmdb_type: 'tv' });
  global.Lampa.Network = { quiet: jest.fn() };
  const pending = matcher.applyBestPoster(item);
  matcher.saveManual(item, 99, 'movie', 1, 0, { poster: 'https://example.test/manual.jpg' });
  global.Lampa.Network.quiet.mock.calls[0][1]({ poster_path: '/old.jpg' });
  await pending;
  expect(storage.get(1).tmdb_id).toBe(99);
  expect(item.poster).toBe('https://example.test/manual.jpg');
});

test('poster transport failures and deadlines resolve without a UI catch', async () => {
  storage.set({ shikimori_id: 1, tmdb_id: 10, tmdb_type: 'tv' });
  global.Lampa.Network = { quiet: jest.fn((url, done, fail) => fail()) };
  await expect(matcher.applyBestPoster(anime())).resolves.toMatchObject({ poster: 'original' });
  global.Lampa.Network.quiet.mockImplementation(() => {});
  const stalled = matcher.applyBestPoster(anime());
  await jest.advanceTimersByTimeAsync(12000);
  await expect(stalled).resolves.toMatchObject({ poster: 'original' });
});
