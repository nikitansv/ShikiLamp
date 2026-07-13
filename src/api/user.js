/**
 * Authenticated Shikimori user API.
 */
const client = require('./client');
const normalizer = require('./normalizer');

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

function listAnimeRates(userId, status, page, limit) {
  if (!userId) return Promise.reject(new Error('User ID пустой'));
  const query = buildQuery({
    status: status,
    page: page || 1,
    limit: limit || 20,
    order: 'updated_at'
  });
  return client.request('/api/users/' + encodeURIComponent(String(userId)) + '/anime_rates?' + query, {
    method: 'GET',
    authenticated: true,
    skipCache: true,
    timeout: 20000
  }).then(normalizeRates);
}

function createAnimeRate(animeId, status) {
  if (!animeId) return Promise.reject(new Error('Anime ID пустой'));
  return client.request('/api/v2/user_rates', {
    method: 'POST',
    authenticated: true,
    skipCache: true,
    timeout: 20000,
    body: {
      user_rate: {
        target_id: animeId,
        target_type: 'Anime',
        status: status || 'planned'
      }
    }
  }).then(normalizeRate);
}

function updateAnimeRate(rateId, patch) {
  if (!rateId) return Promise.reject(new Error('Rate ID пустой'));
  return client.request('/api/v2/user_rates/' + encodeURIComponent(String(rateId)), {
    method: 'PATCH',
    authenticated: true,
    skipCache: true,
    timeout: 20000,
    body: { user_rate: patch || {} }
  }).then(normalizeRate);
}

function deleteAnimeRate(rateId) {
  if (!rateId) return Promise.reject(new Error('Rate ID пустой'));
  return client.request('/api/v2/user_rates/' + encodeURIComponent(String(rateId)), {
    method: 'DELETE',
    authenticated: true,
    skipCache: true,
    timeout: 20000
  });
}

module.exports = {
  RATE_STATUS_TITLES: RATE_STATUS_TITLES,
  listAnimeRates: listAnimeRates,
  createAnimeRate: createAnimeRate,
  updateAnimeRate: updateAnimeRate,
  deleteAnimeRate: deleteAnimeRate,
  normalizeRate: normalizeRate,
  normalizeRates: normalizeRates
};
