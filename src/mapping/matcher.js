/**
 * Match Shikimori anime to TMDB candidates via local storage or search.
 */
const config = require('../config');
const scoring = require('./scoring');
const storage = require('./storage');
const logger = require('../logger');
const cache = require('../cache');
const titles = require('./titles');
const queryRequests = Object.create(null);
const searches = Object.create(null);
const requestQueue = [];
let activeRequests = 0;
const REQUEST_TIMEOUT = 12000;

function enqueueRequest(run) {
  return new Promise(function (resolve) {
    requestQueue.push(function () {
      activeRequests++;
      let finished = false;
      const timer = setTimeout(function () { done(null); }, REQUEST_TIMEOUT);
      function done(value) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        activeRequests--;
        resolve(value);
        drainRequests();
      }
      try { run(done); } catch (error) { done(null); }
    });
    drainRequests();
  });
}

function drainRequests() {
  while (activeRequests < 3 && requestQueue.length) requestQueue.shift()();
}

function searchQuery(api, query) {
  const key = query.toLowerCase();
  if (queryRequests[key]) return queryRequests[key];
  const request = enqueueRequest(function (done) {
    api.search({ query: query }, done, function () { done(null); });
  }).then(function (result) {
    delete queryRequests[key];
    return result;
  });
  queryRequests[key] = request;
  return request;
}

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
  if (local.poster) {
    anime.tmdb_poster = local.poster;
    anime.poster = local.poster;
    anime.image = local.poster;
  }
  return createResult(local, local.mapping_source || 'local', local.confidence || 1.0);
}

function searchTmdb(anime) {
    const tmdbApi = getTmdbApi();
    if (!tmdbApi || !tmdbApi.search) {
      return Promise.reject(new Error('TMDB API not available'));
    }
    const queries = titles.queries(anime);
    const candidates = [];
    const seen = Object.create(null);
    if (!queries.length) return Promise.resolve([]);
    function add(results, type) {
      if (!Array.isArray(results)) return;
      results.forEach(function (item) {
        const normalized = normalizeTmdbItem(item, type);
        if (!normalized) return;
        const s = scoring.score(anime, normalized);
        const key = type + ':' + normalized.id;
        if (s >= 0.35 && !seen[key]) {
          seen[key] = true;
          candidates.push({ item: normalized, score: s, type: type });
        }
      });
    }
    return Promise.all(queries.map(function (query) { return searchQuery(tmdbApi, query); })).then(function (responses) {
      let succeeded = false;
      responses.forEach(function (result) {
        if (result && (result.movie || result.tv)) succeeded = true;
        if (result && result.movie) add(result.movie.results, 'movie');
        if (result && result.tv) add(result.tv.results, 'tv');
      });
      if (!succeeded) throw new Error('TMDB search unavailable');
      candidates.sort(function (a, b) { return b.score - a.score; });
      return candidates;
    });
}

function getTmdbApi() {
  if (typeof Lampa !== 'undefined' && Lampa.Api) return Lampa.Api;
  return null;
}

function normalizeTmdbItem(item, type) {
  if (!item || !Number.isSafeInteger(Number(item.id)) || Number(item.id) < 1) return null;
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
  const normalized = path.charAt(0) === '/' ? path.slice(1) : path;
  if (typeof Lampa !== 'undefined' && Lampa.TMDB && Lampa.TMDB.image) {
    return Lampa.TMDB.image('t/p/w500/' + normalized);
  }
  return 'https://image.tmdb.org/t/p/w500/' + normalized;
}

function fetchTmdbPoster(mapping) {
  if (!mapping || !mapping.tmdb_id || typeof Lampa === 'undefined' || !Lampa.TMDB || !Lampa.TMDB.api) {
    return Promise.resolve('');
  }
  return enqueueRequest(function (resolve) {
    const network = Lampa.Reguest ? new Lampa.Reguest() : Lampa.Network;
    if (!network || !network.quiet) return resolve('');
    if (network.timeout && Lampa.Reguest) network.timeout(REQUEST_TIMEOUT);
    const method = mapping.tmdb_type === 'movie' ? 'movie' : 'tv';
    const key = Lampa.TMDB.key ? Lampa.TMDB.key() : '';
    const url = Lampa.TMDB.api(method + '/' + mapping.tmdb_id + '?language=ru' + (key ? '&api_key=' + key : ''));
    network.quiet(url, function (data) {
      resolve(data && data.poster_path ? tmdbPosterUrl(data.poster_path) : '');
    }, function () { resolve(''); });
  });
}

function applyBestPoster(anime) {
  if (!anime || !anime.shikimori_id) return Promise.resolve(anime);
  const local = storage.get(anime.shikimori_id);
  if (local && local.poster) {
    anime.tmdb_poster = local.poster;
    anime.poster = local.poster;
    anime.image = local.poster;
    return Promise.resolve(anime);
  }
  if (local && !local.poster) {
    return fetchTmdbPoster(local).then(function (poster) {
      if (poster) {
        const current = storage.get(anime.shikimori_id);
        if (!current || current.tmdb_id !== local.tmdb_id || current.tmdb_type !== local.tmdb_type) return anime;
        current.poster = poster;
        storage.set(current);
        anime.tmdb_poster = poster;
        anime.poster = poster;
        anime.image = poster;
      }
      return anime;
    });
  }
  return findBest(anime).then(function (out) {
    const best = out.candidates && out.candidates.length ? out.candidates[0] : null;
    const poster = out.result && best && best.item ? tmdbPosterUrl(best.item.poster_path) : '';
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

  const cacheKey = 'mapping_search:v3:' + JSON.stringify([anime.shikimori_id, titles.queries(anime), anime.kind, anime.year, anime.episodes]);
  const cached = cache.get('mapping', cacheKey, config.CACHE_TTL_MS.mappingFail);
  let request;
  if (cached.hit && Array.isArray(cached.data)) request = Promise.resolve(cached.data);
  else {
    request = searches[cacheKey];
    if (!request) {
      request = searchTmdb(anime).then(function (candidates) {
        cache.set('mapping', cacheKey, candidates);
        delete searches[cacheKey];
        return candidates;
      }, function (error) {
        delete searches[cacheKey];
        throw error;
      });
      searches[cacheKey] = request;
    }
  }
  return request.then(function (candidates) {
    const saved = matchLocal(anime);
    if (saved) return { result: saved, candidates: [], source: 'local' };
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
    return { result: result, candidates: candidates, source: 'auto' };
  }, function (error) {
    const saved = matchLocal(anime);
    if (saved) return { result: saved, candidates: [], source: 'local' };
    throw error;
  });
}

function saveManual(anime, tmdbId, tmdbType, season, episodeOffset, extra) {
  const mapping = {
    shikimori_id: anime.shikimori_id,
    mal_id: anime.mal_id || 0,
    tmdb_id: tmdbId,
    tmdb_type: tmdbType,
    tmdb_season: parseInt(season, 10) || 1,
    episode_offset: parseInt(episodeOffset, 10) || 0,
    poster: extra && extra.poster ? extra.poster : '',
    confidence: 1.0,
    mapping_source: 'manual',
    verified: true
  };
  if (!storage.set(mapping)) throw new Error('MAPPING_SAVE_FAILED');
  if (mapping.poster) {
    anime.tmdb_poster = mapping.poster;
    anime.poster = mapping.poster;
    anime.image = mapping.poster;
  }
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

function openConfident(anime, canOpen) {
  return openBestOrFirst(anime, canOpen);
}

function openBestOrFirst(anime, canOpen) {
  return findBest(anime).then(function (out) {
    if (canOpen && !canOpen()) return false;
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
  openConfident,
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
