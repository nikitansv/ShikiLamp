/**
 * High-level Shikimori API adapter. UI depends only on this module.
 */
const config = require('../config');
const client = require('./client');
const graphql = require('./graphql');
const normalizer = require('./normalizer');
const logger = require('../logger');

function getPageSize() {
  if (typeof Lampa !== 'undefined' && Lampa.Storage) {
    const raw = Lampa.Storage.get(config.STORAGE_KEYS.pageSize, config.DEFAULTS.pageSize);
    const n = parseInt(raw, 10);
    return isNaN(n) ? config.DEFAULTS.pageSize : Math.min(Math.max(n, 5), 50);
  }
  return config.DEFAULTS.pageSize;
}

function graphqlRequest(queryObj, ttlKey) {
  const ttl = config.CACHE_TTL_MS[ttlKey] || 0;
  return client.request(graphql.graphqlPath(), {
    method: 'POST',
    body: queryObj,
    cacheTtl: ttl,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }).then(function (response) {
    if (response && response.errors && response.errors.length) {
      const message = response.errors[0] && response.errors[0].message ? response.errors[0].message : 'GraphQL error';
      throw new Error(message);
    }
    return response && response.data ? response.data : response;
  });
}

function search(query, page) {
  const limit = getPageSize();
  const q = String(query || '').trim();
  logger.debug('search', q, 'limit', limit);
  if (/^\d+$/.test(q)) {
    return graphqlRequest(graphql.getAnimeById(q), 'anime').then(normalizer.normalizeAnimeResponse);
  }
  return graphqlRequest(graphql.searchAnimes(q, limit, page || 1), 'search').then(normalizer.normalizeSearchResponse);
}

function getById(id) {
  return graphqlRequest(graphql.getAnimeById(id), 'anime').then(normalizer.normalizeAnimeResponse);
}

function getByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return Promise.resolve([]);
  return graphqlRequest(graphql.getAnimesByIds(ids), 'anime').then(normalizer.normalizeSearchResponse);
}

function popular(page) {
  return graphqlRequest(graphql.popularAnimes(getPageSize(), page || 1), 'catalog').then(normalizer.normalizeSearchResponse);
}

function ongoing(page) {
  return graphqlRequest(graphql.ongoingAnimes(getPageSize(), page || 1), 'catalog').then(normalizer.normalizeSearchResponse);
}

function latest(page) {
  return graphqlRequest(graphql.releasedAnimes(getPageSize(), page || 1), 'catalog').then(normalizer.normalizeSearchResponse);
}

function announced(page) {
  return graphqlRequest(graphql.announcedAnimes(getPageSize(), page || 1), 'catalog').then(normalizer.normalizeSearchResponse);
}

function catalog(filters) {
  filters = filters || {};
  const params = [];
  Object.keys(filters).forEach(function (key) {
    const value = filters[key];
    if (value !== undefined && value !== null && value !== '') params.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
  });
  if (!filters.limit) params.push('limit=' + getPageSize());
  return client.request('/api/animes?' + params.join('&'), {
    method: 'GET', skipCache: false, cacheTtl: config.CACHE_TTL_MS.catalog, timeout: 20000
  }).then(normalizer.normalizeList);
}

function testConnection() {
  return client.request(graphql.graphqlPath(), {
    method: 'POST',
    body: { query: '{ __schema { queryType { name } } }' },
    skipCache: true,
    timeout: 10000
  });
}

module.exports = {
  search,
  getById,
  getByIds,
  popular,
  ongoing,
  latest,
  announced,
  catalog,
  testConnection,
  graphqlRequest
};
