/**
 * Persistent local mapping storage between Shikimori and TMDB.
 */
const config = require('../config');
const logger = require('../logger');

const STORAGE_KEY = config.STORAGE_KEYS.mappings;
const FORMAT_VERSION = 1;

function getStore() {
  if (typeof Lampa !== 'undefined' && Lampa.Storage) return Lampa.Storage;
  if (typeof global !== 'undefined' && global.__test_storage) return global.__test_storage;
  if (typeof globalThis !== 'undefined' && globalThis.__test_storage) return globalThis.__test_storage;
  return null;
}

function setTestStore(store) {
  if (typeof global !== 'undefined') global.__test_storage = store;
  if (typeof globalThis !== 'undefined') globalThis.__test_storage = store;
}

function load() {
  const store = getStore();
  if (!store) return { v: FORMAT_VERSION, mappings: {} };
  try {
    const raw = store.get(STORAGE_KEY, '');
    if (!raw) return { v: FORMAT_VERSION, mappings: {} };
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || parsed.v !== FORMAT_VERSION) return { v: FORMAT_VERSION, mappings: {} };
    return parsed;
  } catch (e) {
    return { v: FORMAT_VERSION, mappings: {} };
  }
}

function save(data) {
  const store = getStore();
  if (!store) return;
  try {
    store.set(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    logger.warn('Failed to save mappings', e.message);
  }
}

function list() {
  const data = load();
  return Object.keys(data.mappings).map(function (key) {
    return data.mappings[key];
  });
}

function get(shikimoriId) {
  const data = load();
  return data.mappings[String(shikimoriId)] || null;
}

function set(mapping) {
  if (!mapping || !mapping.shikimori_id) return false;
  const data = load();
  data.mappings[String(mapping.shikimori_id)] = Object.assign({}, mapping, {
    updated_at: Date.now ? Date.now() : new Date().getTime()
  });
  save(data);
  return true;
}

function remove(shikimoriId) {
  const data = load();
  const had = !!data.mappings[String(shikimoriId)];
  delete data.mappings[String(shikimoriId)];
  save(data);
  return had;
}

function clear() {
  save({ v: FORMAT_VERSION, mappings: {} });
}

function count() {
  return Object.keys(load().mappings).length;
}

function exportJson() {
  const data = load();
  const safe = {
    v: data.v,
    exported_at: Date.now ? Date.now() : new Date().getTime(),
    mappings: Object.assign({}, data.mappings)
  };
  return JSON.stringify(safe, null, 2);
}

function importJson(text) {
  try {
    const parsed = typeof text === 'string' ? JSON.parse(text) : text;
    if (!parsed || parsed.v !== FORMAT_VERSION || typeof parsed.mappings !== 'object') {
      return { success: false, error: 'Invalid format' };
    }
    save({ v: FORMAT_VERSION, mappings: parsed.mappings || {} });
    return { success: true, count: Object.keys(parsed.mappings || {}).length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  list,
  get,
  set,
  remove,
  clear,
  count,
  exportJson,
  importJson,
  setTestStore
};
