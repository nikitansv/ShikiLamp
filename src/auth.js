/** Shikimori OAuth helpers. User tokens stay in Lampa.Storage. */
const config = require('./config');
const client = require('./api/client');

const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

function getStorage() {
  return typeof Lampa !== 'undefined' && Lampa.Storage ? Lampa.Storage : null;
}

function getValue(key, fallback) {
  const storage = getStorage();
  return storage ? storage.get(key, fallback) : fallback;
}

function setValue(key, value) {
  const storage = getStorage();
  if (storage) storage.set(key, value);
}

function getToken() {
  const token = getValue(config.STORAGE_KEYS.experimentalToken, '');
  return typeof token === 'string' ? token.trim() : '';
}

function setToken(token) {
  setValue(config.STORAGE_KEYS.experimentalToken, String(token || '').trim());
}

function getRefreshToken() {
  return String(getValue(config.STORAGE_KEYS.refreshToken, '') || '').trim();
}

function getClientId() {
  return String(getValue(config.STORAGE_KEYS.oauthClientId, '') || config.OAUTH_CLIENT_ID || '').trim();
}

function getClientSecret() {
  return String(getValue(config.STORAGE_KEYS.oauthClientSecret, '') || config.OAUTH_CLIENT_SECRET || '').trim();
}

function setCredentials(clientId, clientSecret) {
  setValue(config.STORAGE_KEYS.oauthClientId, String(clientId || '').trim());
  setValue(config.STORAGE_KEYS.oauthClientSecret, String(clientSecret || '').trim());
}

function clearToken() {
  setToken('');
  setValue(config.STORAGE_KEYS.refreshToken, '');
  setValue(config.STORAGE_KEYS.tokenExpiresAt, 0);
  setValue(config.STORAGE_KEYS.authUser, null);
  setValue(config.STORAGE_KEYS.authCheckedAt, 0);
}

function getCachedUser() {
  return getValue(config.STORAGE_KEYS.authUser, null);
}

function saveUser(user) {
  setValue(config.STORAGE_KEYS.authUser, user || null);
  setValue(config.STORAGE_KEYS.authCheckedAt, Date.now ? Date.now() : new Date().getTime());
}

function statusText() {
  const user = getCachedUser();
  if (user && (user.nickname || user.name || user.id)) return 'Войти: ' + (user.nickname || user.name || ('ID ' + user.id));
  return getToken() ? 'Токен введён, вход не проверен' : 'Не авторизован';
}

function buildAuthorizationUrl(clientId) {
  const id = String(clientId || getClientId()).trim();
  if (!id) throw new Error('OAuth Client ID пустой');
  return config.SHIKIMORI_HOST_DEFAULT + '/oauth/authorize?' + [
    'client_id=' + encodeURIComponent(id),
    'redirect_uri=' + encodeURIComponent(REDIRECT_URI),
    'response_type=code',
    'scope=user_rates'
  ].join('&');
}

function formBody(values) {
  return Object.keys(values).map(function (key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(values[key]);
  }).join('&');
}

function saveTokenBundle(bundle) {
  if (!bundle || !bundle.access_token || !bundle.refresh_token) throw new Error('Некорректный token response Shikimori');
  const createdAt = Number(bundle.created_at) || Math.floor(Date.now() / 1000);
  const expiresIn = Number(bundle.expires_in) || 86400;
  setToken(bundle.access_token);
  setValue(config.STORAGE_KEYS.refreshToken, bundle.refresh_token);
  setValue(config.STORAGE_KEYS.tokenExpiresAt, createdAt + expiresIn);
  return bundle;
}

function tokenRequest(values) {
  return client.request('/oauth/token', {
    method: 'POST',
    body: formBody(values),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    skipCache: true,
    timeout: 15000
  }).then(saveTokenBundle);
}

function check() {
  if (!getToken()) return Promise.reject(new Error('Access token пустой'));
  return client.request('/api/users/whoami', {
    method: 'GET', authenticated: true, skipCache: true, timeout: 15000
  }).then(function (user) {
    if (!user || !user.id) throw new Error('Некорректный ответ Shikimori');
    saveUser(user);
    return user;
  });
}

function exchangeCode(code, clientId, clientSecret) {
  const id = String(clientId || getClientId()).trim();
  const secret = String(clientSecret || getClientSecret()).trim();
  const cleanCode = String(code || '').trim();
  if (!id || !secret || !cleanCode) return Promise.reject(new Error('OAuth Client ID, Client Secret и code обязательны'));
  return tokenRequest({
    grant_type: 'authorization_code', client_id: id, client_secret: secret,
    code: cleanCode, redirect_uri: REDIRECT_URI
  }).then(check);
}

function refresh(clientId, clientSecret) {
  const id = String(clientId || getClientId()).trim();
  const secret = String(clientSecret || getClientSecret()).trim();
  const refreshToken = getRefreshToken();
  if (!id || !secret || !refreshToken) return Promise.reject(new Error('Данные OAuth refresh отсутствуют'));
  return tokenRequest({ grant_type: 'refresh_token', client_id: id, client_secret: secret, refresh_token: refreshToken });
}

module.exports = {
  REDIRECT_URI, getToken, setToken, getRefreshToken, clearToken,
  getCachedUser, saveUser, statusText, check,
  getClientId, getClientSecret, setCredentials,
  buildAuthorizationUrl, exchangeCode, refresh
};
