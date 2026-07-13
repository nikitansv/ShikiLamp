/**
 * Plugin configuration
 */
const PLUGIN_ID = 'shikimori_local';
const VERSION = '0.1.0';
const SHIKIMORI_HOST_DEFAULT = 'https://shikimori.io';
const GRAPHQL_PATH = '/api/graphql';
const REST_PATH = '/api/animes';

const STORAGE_KEYS = {
  enabled: 'shikimori_local_enabled',
  apiBaseUrl: 'shikimori_local_api_base_url',
  language: 'shikimori_local_language',
  showMenu: 'shikimori_local_show_menu',
  pageSize: 'shikimori_local_page_size',
  mappingThreshold: 'shikimori_local_mapping_threshold',
  autoOpenExact: 'shikimori_local_auto_open_exact',
  debug: 'shikimori_local_debug',
  mappings: 'shikimori_local_mappings',
  cache: 'shikimori_local_cache',
  experimentalToken: 'shikimori_local_experimental_token',
  refreshToken: 'shikimori_local_refresh_token',
  tokenExpiresAt: 'shikimori_local_token_expires_at',
  oauthClientId: 'shikimori_local_oauth_client_id',
  oauthClientSecret: 'shikimori_local_oauth_client_secret',
  experimentalFeatures: 'shikimori_local_experimental_features',
  authUser: 'shikimori_local_auth_user',
  authCheckedAt: 'shikimori_local_auth_checked_at',
  lastCleared: 'shikimori_local_last_cleared'
};

const CACHE_TTL_MS = {
  search: 10 * 60 * 1000,
  anime: 6 * 60 * 60 * 1000,
  catalog: 30 * 60 * 1000,
  mappingFail: 24 * 60 * 60 * 1000
};

const DEFAULTS = {
  enabled: true,
  apiBaseUrl: SHIKIMORI_HOST_DEFAULT,
  language: 'russian',
  showMenu: true,
  pageSize: 20,
  mappingThreshold: 0.90,
  autoOpenExact: false,
  debug: false
};

const LANGUAGE = {
  ru: 'russian',
  en: 'english'
};

module.exports = {
  PLUGIN_ID,
  VERSION,
  SHIKIMORI_HOST_DEFAULT,
  GRAPHQL_PATH,
  REST_PATH,
  STORAGE_KEYS,
  CACHE_TTL_MS,
  DEFAULTS,
  LANGUAGE
};
