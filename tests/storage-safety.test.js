const storage = require('../src/mapping/storage');
const config = require('../src/config');
const originalLampa = global.Lampa;
const key = config.STORAGE_KEYS.mappings;
const mapping = (id, tmdbId = id + 10) => ({ shikimori_id: id, tmdb_id: tmdbId, tmdb_type: 'tv' });
let data;
let store;

beforeEach(() => {
  data = { [key]: JSON.stringify({ v: 1, mappings: { 1: mapping(1) } }) };
  store = { get: jest.fn((name, fallback) => name in data ? data[name] : fallback),
    set: jest.fn((name, value) => { data[name] = value; }) };
  global.Lampa = { Storage: store };
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { global.Lampa = originalLampa; jest.restoreAllMocks(); });

test('imports merge valid records, preserve conflicts, and reject malformed IDs without data loss', () => {
  const imported = storage.importJson({ v: 1, mappings: { 1: mapping(1, 99), 2: mapping(2),
    3: mapping('3bad'), 4: { ...mapping(4), tmdb_id: -1 } } });
  expect(imported).toMatchObject({ success: true, count: 1, skipped: 1 });
  expect(storage.list()).toEqual(expect.arrayContaining([mapping(1), expect.objectContaining(mapping(2))]));
  expect(storage.count()).toBe(2);
  const before = data[key];
  expect(storage.importJson({ v: 1, mappings: { bad: null } }).success).toBe(false);
  expect(storage.importJson({ v: 1, mappings: [] }).success).toBe(false);
  expect(data[key]).toBe(before);
});

test('read failures prevent imports, sets and removals from overwriting existing mappings', () => {
  const before = data[key];
  store.get.mockImplementation(() => { throw new Error('storage temporarily unavailable'); });
  expect(storage.importJson({ v: 1, mappings: { 2: mapping(2) } }).success).toBe(false);
  expect(storage.set(mapping(2))).toBe(false);
  expect(storage.remove(1)).toBe(false);
  expect(store.set).not.toHaveBeenCalled();
  expect(data[key]).toBe(before);
});

test('corrupt stored data stays recoverable when an import is attempted', () => {
  data[key] = '{broken-json';
  expect(storage.importJson({ v: 1, mappings: { 2: mapping(2) } }).success).toBe(false);
  expect(data[key]).toBe('{broken-json');
  expect(store.set).not.toHaveBeenCalled();
});

test('quota failure cannot mutate an object returned by the storage backend', () => {
  data[key] = { v: 1, mappings: { 1: mapping(1) } };
  store.set.mockImplementation(() => { throw new Error('QuotaExceededError'); });
  expect(storage.set(mapping(2))).toBe(false);
  expect(storage.remove(1)).toBe(false);
  expect(storage.importJson({ v: 1, mappings: { 3: mapping(3) } }).success).toBe(false);
  expect(data[key]).toEqual({ v: 1, mappings: { 1: mapping(1) } });
});

test('empty and conflict-only imports succeed without unnecessary quota-limited writes', () => {
  store.set.mockImplementation(() => { throw new Error('QuotaExceededError'); });
  expect(storage.importJson({ v: 1, mappings: {} })).toMatchObject({ success: true, count: 0 });
  expect(storage.importJson({ v: 1, mappings: { 1: mapping(1, 99) } })).toMatchObject({ success: true, count: 0, skipped: 1 });
  expect(store.set).not.toHaveBeenCalled();
});
