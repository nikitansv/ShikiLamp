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

function load(strict) {
  const store = getStore();
  if (!store) return { v: FORMAT_VERSION, mappings: {} };
  try {
    const raw = store.get(STORAGE_KEY, '');
    if (!raw) return { v: FORMAT_VERSION, mappings: {} };
    const parsed = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
    if (!parsed || parsed.v !== FORMAT_VERSION || !parsed.mappings || typeof parsed.mappings !== 'object' || Array.isArray(parsed.mappings)) throw new Error('Invalid stored mapping format');
    return parsed;
  } catch (e) {
    if (strict) throw e;
    return { v: FORMAT_VERSION, mappings: {} };
  }
}

function save(data) {
  const store = getStore();
  if (!store) return false;
  try {
    store.set(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    logger.warn('Failed to save mappings', e.message);
    return false;
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
  return Object.prototype.hasOwnProperty.call(data.mappings, String(shikimoriId)) ? data.mappings[String(shikimoriId)] : null;
}

function set(mapping) {
  if (!mapping || !positiveId(mapping.shikimori_id) || !positiveId(mapping.tmdb_id) || ['tv', 'movie'].indexOf(mapping.tmdb_type) < 0) return false;
  try {
    const data = load(true);
    data.mappings[String(mapping.shikimori_id)] = Object.assign({}, mapping, {
      updated_at: Date.now ? Date.now() : new Date().getTime()
    });
    return save(data);
  } catch (e) {
    logger.warn('Failed to update mappings', e.message);
    return false;
  }
}

function remove(shikimoriId) {
  try {
    const data = load(true);
    const had = !!data.mappings[String(shikimoriId)];
    delete data.mappings[String(shikimoriId)];
    return save(data) && had;
  } catch (e) {
    logger.warn('Failed to remove mapping', e.message);
    return false;
  }
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
    if (!parsed || parsed.v !== FORMAT_VERSION || !parsed.mappings || typeof parsed.mappings !== 'object' || Array.isArray(parsed.mappings)) {
      return { success: false, error: 'Invalid format' };
    }
    const mappings = Object.assign({}, load(true).mappings);
    let count = 0;
    let skipped = 0;
    Object.keys(parsed.mappings || {}).forEach(function (key) {
      const source = parsed.mappings[key];
      if (!source || typeof source !== 'object') return;
      const shikimoriId = parseInt(source.shikimori_id || key, 10);
      const tmdbId = parseInt(source.tmdb_id, 10);
      const tmdbType = source.tmdb_type === 'tv' || source.tmdb_type === 'movie' ? source.tmdb_type : '';
      if (!positiveId(source.shikimori_id || key) || !positiveId(source.tmdb_id) || !tmdbType) return;
      if (Object.prototype.hasOwnProperty.call(mappings, String(shikimoriId))) { skipped++; return; }
      const poster = typeof source.poster === 'string' && /^https?:\/\//i.test(source.poster) ? source.poster.slice(0, 2000) : '';
      mappings[String(shikimoriId)] = {
        shikimori_id: shikimoriId,
        mal_id: parseInt(source.mal_id, 10) || 0,
        tmdb_id: tmdbId,
        tmdb_type: tmdbType,
        tmdb_season: Math.max(1, parseInt(source.tmdb_season, 10) || 1),
        episode_offset: parseInt(source.episode_offset, 10) || 0,
        poster: poster,
        confidence: Math.min(1, Math.max(0, Number(source.confidence) || 0)),
        mapping_source: source.mapping_source === 'manual' ? 'manual' : 'import',
        verified: source.verified === true,
        updated_at: Number(source.updated_at) || Date.now()
      };
      count++;
    });
    if (!count && !skipped && Object.keys(parsed.mappings).length) return { success: false, error: 'No valid mappings' };
    if (count && !save({ v: FORMAT_VERSION, mappings: mappings })) return { success: false, error: 'Не удалось сохранить mapping' };
    return { success: true, count: count, skipped: skipped };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function positiveId(value) {
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
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
