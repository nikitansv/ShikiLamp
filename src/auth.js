/**
 * Shikimori auth helpers. Token is user-provided and stored only in Lampa.Storage.
 */
const config = require('./config');
const client = require('./api/client');

function getStorage() {
  return typeof Lampa !== 'undefined' && Lampa.Storage ? Lampa.Storage : null;
}

function getToken() {
  const storage = getStorage();
  if (!storage) return '';
  const token = storage.get(config.STORAGE_KEYS.experimentalToken, '');
  return typeof token === 'string' ? token.trim() : '';
}

function setToken(token) {
  const storage = getStorage();
  if (!storage) return;
  storage.set(config.STORAGE_KEYS.experimentalToken, String(token || '').trim());
}

function clearToken() {
  const storage = getStorage();
  if (!storage) return;
  storage.set(config.STORAGE_KEYS.experimentalToken, '');
  storage.set(config.STORAGE_KEYS.authUser, null);
  storage.set(config.STORAGE_KEYS.authCheckedAt, 0);
}

function getCachedUser() {
  const storage = getStorage();
  if (!storage) return null;
  return storage.get(config.STORAGE_KEYS.authUser, null);
}

function saveUser(user) {
  const storage = getStorage();
  if (!storage) return;
  storage.set(config.STORAGE_KEYS.authUser, user || null);
  storage.set(config.STORAGE_KEYS.authCheckedAt, Date.now ? Date.now() : new Date().getTime());
}

function statusText() {
  const user = getCachedUser();
  if (user && (user.nickname || user.name || user.id)) {
    return 'Войти: ' + (user.nickname || user.name || ('ID ' + user.id));
  }
  return getToken() ? 'Токен введён, вход не проверен' : 'Не авторизован';
}

function check() {
  if (!getToken()) return Promise.reject(new Error('Access token пустой'));
  return client.request('/api/users/whoami', {
    method: 'GET',
    authenticated: true,
    skipCache: true,
    timeout: 15000
  }).then(function (user) {
    if (!user || !user.id) throw new Error('Некорректный ответ Shikimori');
    saveUser(user);
    return user;
  });
}

module.exports = {
  getToken: getToken,
  setToken: setToken,
  clearToken: clearToken,
  getCachedUser: getCachedUser,
  saveUser: saveUser,
  statusText: statusText,
  check: check
};
