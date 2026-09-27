/**
 * Authenticated Shikimori user API.
 */
const client = require('./client');
const normalizer = require('./normalizer');
const api = require('./index');
const config = require('../config');
const logger = require('../logger');

const RATE_STATUS_TITLES = {
  planned: 'В планах',
  watching: 'Смотрю',
  completed: 'Просмотрено',
  on_hold: 'Отложено',
  dropped: 'Брошено'
};

function buildQuery(params) {
  return Object.keys(params).filter(function (key) {
    return params[key] !== undefined && params[key] !== null && params[key] !== '';
  }).map(function (key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(String(params[key]));
  }).join('&');
}

function normalizeRate(rate) {
  if (!rate) return null;
  const anime = normalizer.normalizeAnime(rate.anime || rate.target || rate);
  if (!anime) return null;
  anime.rate_id = rate.id || 0;
  anime.user_rate_status = rate.status || '';
  anime.user_score = parseInt(rate.score, 10) || 0;
  anime.user_episodes = parseInt(rate.episodes, 10) || 0;
  anime.user_rewatches = parseInt(rate.rewatches, 10) || 0;
  anime.user_text = rate.text || '';
  return anime;
}

function normalizeRates(list) {
  return Array.isArray(list) ? list.map(normalizeRate).filter(Boolean) : [];
}

function withRequestOptions(options, fixed) {
  return Object.assign({}, options || {}, fixed);
}

function fetchAnimeRatesPage(userId, status, page, limit, options) {
  if (!userId) return Promise.reject(new Error('User ID пустой'));
  const query = buildQuery({
    status: status,
    page: page || 1,
    limit: limit || 20,
    order: status === 'planned' || status === 'watching' ? 'aired_on' : 'updated_at'
  });
  return client.request('/api/users/' + encodeURIComponent(String(userId)) + '/anime_rates?' + query, withRequestOptions(options, {
    method: 'GET',
    authenticated: true,
    skipCache: true,
    timeout: 20000
  })).then(normalizeRates);
}

function listAnimeRates(userId, status, page, limit, options) {
  return fetchAnimeRatesPage(userId, status, page, limit, options).then(function (rates) {
    return hydrateAnimeDetails(rates, options);
  });
}

function listAllAnimeRates(userId, status, options) {
  const pageSize = 100;
  const maxPages = 100;
  const all = [];

  function load(page) {
    return fetchAnimeRatesPage(userId, status, page, pageSize, options).then(function (list) {
      all.push.apply(all, list);
      if (list.length === pageSize && page < maxPages) return load(page + 1);
      if (list.length === pageSize && page >= maxPages) {
        // Keep a safety bound against a broken API, but make the truncation visible.
        logger.warn('Anime rates pagination limit reached', status, maxPages * pageSize);
      }
      return hydrateAnimeDetails(all, options);
    });
  }

  return load(1);
}

function hydrateAnimeDetails(rates, options) {
  const ids = rates.map(function (anime) { return anime.shikimori_id; }).filter(Boolean);
  if (!ids.length) return rates;
  const batches = [];
  for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100));
  return batches.reduce(function (promise, batch) {
    return promise.then(function (details) {
      return api.getByIds(batch, options).then(function (next) { return details.concat(next || []); });
    });
  }, Promise.resolve([])).then(function (details) {
    const byId = {};
    details.forEach(function (anime) { byId[anime.shikimori_id] = anime; });
    return rates.map(function (rate) {
      return byId[rate.shikimori_id] ? Object.assign({}, rate, byId[rate.shikimori_id]) : rate;
    });
  }).catch(function () {
    return rates;
  });
}

function isCurrentlyAiring(anime) {
  const aired = parseInt(anime && anime.episodes_aired, 10) || 0;
  const total = parseInt(anime && anime.episodes, 10) || 0;
  return aired > 0 && (!total || aired < total);
}

function listCurrentAnimeRates(userId, page, limit, options) {
  return listMyListAnimes('planned,watching', 'ongoing', page, limit, options);
}

function listMyListAnimes(mylist, status, page, limit, options) {
  const query = buildQuery({
    status: status || '',
    mylist: mylist,
    order: 'aired_on',
    page: page || 1,
    limit: limit || 50
  });
  return client.request('/api/animes?' + query, withRequestOptions(options, {
    method: 'GET', authenticated: true, skipCache: true, timeout: 20000
  })).then(normalizer.normalizeList);
}

function getCachedUserId() {
  if (typeof Lampa === 'undefined' || !Lampa.Storage) return null;
  const user = Lampa.Storage.get(config.STORAGE_KEYS.authUser, null);
  return user && user.id ? user.id : null;
}

function createAnimeRate(animeId, status, options) {
  if (!animeId) return Promise.reject(new Error('Anime ID пустой'));
  const userId = getCachedUserId();
  if (!userId) return Promise.reject(new Error('User ID пустой: проверьте вход Shikimori'));
  return client.request('/api/v2/user_rates', withRequestOptions(options, {
    method: 'POST',
    authenticated: true,
    skipCache: true,
    timeout: 20000,
    body: {
      user_rate: {
        user_id: userId,
        target_id: animeId,
        target_type: 'Anime',
        status: status || 'planned'
      }
    }
  })).then(normalizeRate);
}

function updateAnimeRate(rateId, patch, options) {
  if (!rateId) return Promise.reject(new Error('Rate ID пустой'));
  return client.request('/api/v2/user_rates/' + encodeURIComponent(String(rateId)), withRequestOptions(options, {
    method: 'PATCH',
    authenticated: true,
    skipCache: true,
    timeout: 20000,
    body: { user_rate: patch || {} }
  })).then(normalizeRate);
}

function deleteAnimeRate(rateId, options) {
  if (!rateId) return Promise.reject(new Error('Rate ID пустой'));
  return client.request('/api/v2/user_rates/' + encodeURIComponent(String(rateId)), withRequestOptions(options, {
    method: 'DELETE',
    authenticated: true,
    skipCache: true,
    timeout: 20000
  }));
}

module.exports = {
  RATE_STATUS_TITLES: RATE_STATUS_TITLES,
  listAnimeRates: listAnimeRates,
  listAllAnimeRates: listAllAnimeRates,
  listCurrentAnimeRates: listCurrentAnimeRates,
  listMyListAnimes: listMyListAnimes,
  isCurrentlyAiring: isCurrentlyAiring,
  createAnimeRate: createAnimeRate,
  updateAnimeRate: updateAnimeRate,
  deleteAnimeRate: deleteAnimeRate,
  normalizeRate: normalizeRate,
  normalizeRates: normalizeRates,
  hydrateAnimeDetails: hydrateAnimeDetails
};
