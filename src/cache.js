/**
 * Local cache with TTL and size limits.
 */
const config = require('./config');
const logger = require('./logger');

const STORAGE_KEY = config.STORAGE_KEYS.cache;
const MAX_ENTRIES = 500;
const VERSION = 1;

function now() {
  return Date.now ? Date.now() : new Date().getTime();
}

function getStore() {
  if (typeof Lampa !== 'undefined' && Lampa.Storage && Lampa.Storage.get) {
    return Lampa.Storage;
  }
  // fallback for unit tests
  if (typeof global !== 'undefined' && global.__test_storage) return global.__test_storage;
  if (typeof globalThis !== 'undefined' && globalThis.__test_storage) return globalThis.__test_storage;
  return null;
}

function setTestStore(store) {
  if (typeof global !== 'undefined') global.__test_storage = store;
  if (typeof globalThis !== 'undefined') globalThis.__test_storage = store;
}

function loadCache() {
  const store = getStore();
  if (!store) return { v: VERSION, items: {} };
  try {
    const raw = store.get(STORAGE_KEY, '');
    if (!raw) return { v: VERSION, items: {} };
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || parsed.v !== VERSION) return { v: VERSION, items: {} };
    return parsed;
  } catch (e) {
    return { v: VERSION, items: {} };
  }
}

function saveCache(data) {
  const store = getStore();
  if (!store) return;
  try {
    store.set(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    logger.warn('Failed to save cache', e.message);
  }
}

function makeKey(type, params) {
  return type + ':' + (typeof params === 'string' ? params : JSON.stringify(params));
}

function get(type, params, ttlMs) {
  const cache = loadCache();
  const key = makeKey(type, params);
  const entry = cache.items[key];
  if (!entry) return { hit: false, stale: false, data: null };
  const age = now() - entry.t;
  if (typeof ttlMs === 'number' && ttlMs >= 0 && age > ttlMs) {
    return { hit: false, stale: true, data: entry.d };
  }
  return { hit: true, stale: false, data: entry.d };
}

function set(type, params, data) {
  const cache = loadCache();
  const key = makeKey(type, params);
  cache.items[key] = { t: now(), d: data };
  const keys = Object.keys(cache.items);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort(function (a, b) {
      return cache.items[a].t - cache.items[b].t;
    });
    const remove = sorted.slice(0, keys.length - MAX_ENTRIES);
    remove.forEach(function (k) {
      delete cache.items[k];
    });
  }
  saveCache(cache);
}

function clear() {
  saveCache({ v: VERSION, items: {} });
}

function size() {
  return Object.keys(loadCache().items).length;
}

module.exports = { get, set, clear, size, makeKey, setTestStore };
