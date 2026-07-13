/**
 * Match Shikimori anime to TMDB candidates via local storage or search.
 */
const config = require('../config');
const scoring = require('./scoring');
const storage = require('./storage');
const logger = require('../logger');
const cache = require('../cache');

function getThreshold() {
  if (typeof Lampa !== 'undefined' && Lampa.Storage) {
    const raw = Lampa.Storage.get(config.STORAGE_KEYS.mappingThreshold, config.DEFAULTS.mappingThreshold);
    const n = parseFloat(raw);
    return isNaN(n) ? config.DEFAULTS.mappingThreshold : Math.min(Math.max(n, 0.5), 1.0);
  }
  return config.DEFAULTS.mappingThreshold;
}

function getAutoOpenExact() {
  if (typeof Lampa !== 'undefined' && Lampa.Storage) {
    return Lampa.Storage.get(config.STORAGE_KEYS.autoOpenExact, config.DEFAULTS.autoOpenExact) === true;
  }
  return config.DEFAULTS.autoOpenExact;
}

function createResult(mapping, source, confidence) {
  return {
    shikimori_id: mapping.shikimori_id,
    mal_id: mapping.mal_id || 0,
    tmdb_id: mapping.tmdb_id,
    tmdb_type: mapping.tmdb_type,
    tmdb_season: mapping.tmdb_season || 1,
    episode_offset: mapping.episode_offset || 0,
    confidence: confidence,
    mapping_source: source,
    verified: mapping.verified || false
  };
}

function matchLocal(anime) {
  const local = storage.get(anime.shikimori_id);
  if (!local) return null;
  return createResult(local, local.mapping_source || 'local', local.confidence || 1.0);
}

function searchTmdb(anime) {
  return new Promise(function (resolve, reject) {
    const tmdbApi = getTmdbApi();
    if (!tmdbApi || !tmdbApi.search) {
      return reject(new Error('TMDB API not available'));
    }
    const query = anime.original_title || anime.title || anime.russian_title;
    const candidates = [];
    let pending = 2;
    function checkDone(err) {
      pending--;
      if (pending > 0) return;
      candidates.sort(function (a, b) { return b.score - a.score; });
      resolve(candidates);
    }
    function add(results, type) {
      if (!Array.isArray(results)) return;
      results.forEach(function (item) {
        const normalized = normalizeTmdbItem(item, type);
        if (!normalized) return;
        const s = scoring.score(anime, normalized);
        if (s >= 0.35) {
          candidates.push({ item: normalized, score: s, type: type });
        }
      });
    }
    tmdbApi.search({ query: query }, function (result) {
      try {
        if (result && result.movie) add(result.movie.results, 'movie');
        if (result && result.tv) add(result.tv.results, 'tv');
      } catch (e) { logger.warn('TMDB search error', e.message); }
      checkDone();
    }, function () {
      checkDone();
    });
    tmdbApi.search({ query: anime.russian_title || anime.title }, function (result) {
      try {
        if (result && result.movie) add(result.movie.results, 'movie');
        if (result && result.tv) add(result.tv.results, 'tv');
      } catch (e) { logger.warn('TMDB search error', e.message); }
      checkDone();
    }, function () {
      checkDone();
    });
  });
}

function getTmdbApi() {
  if (typeof Lampa !== 'undefined' && Lampa.Api) return Lampa.Api;
  return null;
}

function normalizeTmdbItem(item, type) {
  if (!item) return null;
  const year = parseInt((item.release_date || item.first_air_date || '0000').slice(0, 4), 10) || 0;
  return {
    id: item.id,
    name: item.title || item.name || '',
    original_name: item.original_title || item.original_name || '',
    russian_title: '',
    year: year,
    media_type: type,
    type: type,
    episodes: item.episode_count || item.number_of_episodes || 0,
    poster_path: item.poster_path || '',
    overview: item.overview || ''
  };
}

function tmdbPosterUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return 'https://image.tmdb.org/t/p/w500' + path;
}

function applyBestPoster(anime) {
  if (!anime || !anime.shikimori_id) return Promise.resolve(anime);
  return findBest(anime).then(function (out) {
    const best = out.candidates && out.candidates.length ? out.candidates[0] : null;
    const poster = best && best.item ? tmdbPosterUrl(best.item.poster_path) : '';
    if (poster) {
      anime.tmdb_poster = poster;
      anime.poster = poster;
      anime.image = poster;
    }
    return anime;
  }).catch(function () {
    return anime;
  });
}

function findBest(anime) {
  const local = matchLocal(anime);
  if (local) return Promise.resolve({ result: local, candidates: [], source: 'local' });

  if (typeof Lampa === 'undefined' || !Lampa.Api || !Lampa.Api.search) {
    return Promise.resolve({ result: null, candidates: [], source: 'no_tmdb' });
  }

  const cacheKey = 'mapping_search:' + anime.shikimori_id;
  const cached = cache.get('mapping', cacheKey, config.CACHE_TTL_MS.mappingFail);
  if (cached.hit) return Promise.resolve(cached.data);

  return searchTmdb(anime).then(function (candidates) {
    const threshold = getThreshold();
    const best = candidates.length > 0 ? candidates[0] : null;
    let result = null;
    if (best && best.score >= threshold) {
      result = createResult({
        shikimori_id: anime.shikimori_id,
        mal_id: anime.mal_id,
        tmdb_id: best.item.id,
        tmdb_type: best.type,
        tmdb_season: 1,
        episode_offset: 0
      }, 'auto', best.score);
    }
    const out = { result: result, candidates: candidates, source: 'auto' };
    cache.set('mapping', cacheKey, out);
    return out;
  });
}

function saveManual(anime, tmdbId, tmdbType, season, episodeOffset) {
  const mapping = {
    shikimori_id: anime.shikimori_id,
    mal_id: anime.mal_id || 0,
    tmdb_id: tmdbId,
    tmdb_type: tmdbType,
    tmdb_season: parseInt(season, 10) || 1,
    episode_offset: parseInt(episodeOffset, 10) || 0,
    confidence: 1.0,
    mapping_source: 'manual',
    verified: true
  };
  storage.set(mapping);
  return mapping;
}

function openLampaCard(anime, mapping) {
  if (!mapping || !mapping.tmdb_id) return false;
  if (typeof Lampa === 'undefined') return false;
  const method = mapping.tmdb_type === 'movie' ? 'movie' : 'tv';
  const card = buildLampaCard(anime, mapping, method);
  if (Lampa.Activity && typeof Lampa.Activity.push === 'function') {
    Lampa.Activity.push({
      url: '',
      title: card.title || card.name || anime.title,
      component: 'full',
      id: card.id,
      method: method,
      source: 'tmdb',
      card: card
    });
  } else if (Lampa.Router && typeof Lampa.Router.call === 'function') {
    Lampa.Router.call('full', card);
  } else {
    return false;
  }
  return true;
}

function openBestOrFirst(anime) {
  return findBest(anime).then(function (out) {
    if (out.result) return openLampaCard(anime, out.result);
    const best = out.candidates && out.candidates.length ? out.candidates[0] : null;
    if (!best) return false;
    return openLampaCard(anime, createResult({
      shikimori_id: anime.shikimori_id,
      mal_id: anime.mal_id,
      tmdb_id: best.item.id,
      tmdb_type: best.type,
      tmdb_season: 1,
      episode_offset: 0
    }, 'first-candidate', best.score));
  });
}

function buildLampaCard(anime, mapping, method) {
  const card = {
    id: mapping.tmdb_id,
    method: method,
    source: 'tmdb',
    title: anime.title,
    original_name: anime.original_title,
    original_title: anime.original_title,
    release_date: anime.year ? String(anime.year) + '-01-01' : '',
    first_air_date: anime.year ? String(anime.year) + '-01-01' : '',
    poster_path: anime.poster,
    backdrop_path: anime.poster,
    overview: anime.description,
    vote_average: anime.score,
    genre_ids: [],
    shikimori_id: anime.shikimori_id,
    shikimori_mal_id: anime.mal_id,
    shikimori_tmdb_season: mapping.tmdb_season,
    shikimori_episode_offset: mapping.episode_offset,
    shikimori_mapping_confidence: mapping.confidence
  };
  if (method === 'tv') {
    card.name = anime.title;
    card.original_name = anime.original_title;
  }
  return card;
}

module.exports = {
  findBest,
  saveManual,
  openLampaCard,
  openBestOrFirst,
  buildLampaCard,
  getThreshold,
  getAutoOpenExact,
  matchLocal,
  searchTmdb,
  normalizeTmdbItem,
  applyBestPoster,
  tmdbPosterUrl
};
