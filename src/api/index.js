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
  });
}

function search(query) {
  const limit = getPageSize();
  const q = String(query || '').trim();
  logger.debug('search', q, 'limit', limit);
  if (/^\d+$/.test(q)) {
    return graphqlRequest(graphql.getAnimeById(q), 'anime').then(normalizer.normalizeAnimeResponse);
  }
  return graphqlRequest(graphql.searchAnimes(q, limit), 'search').then(normalizer.normalizeSearchResponse);
}

function getById(id) {
  return graphqlRequest(graphql.getAnimeById(id), 'anime').then(normalizer.normalizeAnimeResponse);
}

function popular() {
  return graphqlRequest(graphql.popularAnimes(getPageSize()), 'catalog').then(normalizer.normalizeSearchResponse);
}

function ongoing() {
  return graphqlRequest(graphql.ongoingAnimes(getPageSize()), 'catalog').then(normalizer.normalizeSearchResponse);
}

function latest() {
  return graphqlRequest(graphql.releasedAnimes(getPageSize()), 'catalog').then(normalizer.normalizeSearchResponse);
}

function announced() {
  return graphqlRequest(graphql.announcedAnimes(getPageSize()), 'catalog').then(normalizer.normalizeSearchResponse);
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
  popular,
  ongoing,
  latest,
  announced,
  testConnection,
  graphqlRequest
};
