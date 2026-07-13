const config = require('../src/config');

function makeStorage() {
  const data = {};
  return {
    get: (key, fallback) => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback,
    set: (key, value) => { data[key] = value; },
    data
  };
}

function loadAuth(storage, request) {
  jest.resetModules();
  global.Lampa = { Storage: storage };
  jest.doMock('../src/api/client', () => ({ request }));
  return require('../src/auth');
}

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  delete global.Lampa;
});

test('buildAuthorizationUrl uses bundled client id, OOB redirect and user_rates scope', () => {
  const auth = loadAuth(makeStorage(), jest.fn());
  const url = new URL(auth.buildAuthorizationUrl());
  expect(url.origin + url.pathname).toBe('https://shikimori.io/oauth/authorize');
  expect(url.searchParams.get('client_id')).toBe(config.OAUTH_CLIENT_ID);
  expect(url.searchParams.get('redirect_uri')).toBe('urn:ietf:wg:oauth:2.0:oob');
  expect(url.searchParams.get('response_type')).toBe('code');
  expect(url.searchParams.get('scope')).toBe('user_rates');
});

test('exchangeCode stores token bundle and verifies user', async () => {
  const storage = makeStorage();
  const request = jest.fn()
    .mockResolvedValueOnce({ access_token: 'access', refresh_token: 'refresh', created_at: 100, expires_in: 86400 })
    .mockResolvedValueOnce({ id: 7, nickname: 'Nikita' });
  const auth = loadAuth(storage, request);

  const user = await auth.exchangeCode('code', 'id', 'secret');

  expect(user.nickname).toBe('Nikita');
  expect(storage.data[config.STORAGE_KEYS.experimentalToken]).toBe('access');
  expect(storage.data[config.STORAGE_KEYS.refreshToken]).toBe('refresh');
  expect(storage.data[config.STORAGE_KEYS.tokenExpiresAt]).toBe(86500);
  expect(request.mock.calls[0][0]).toBe('/oauth/token');
  expect(request.mock.calls[0][1].body).toContain('client_secret=secret');
});

test('refresh rotates both tokens', async () => {
  const storage = makeStorage();
  storage.set(config.STORAGE_KEYS.refreshToken, 'old-refresh');
  const request = jest.fn().mockResolvedValue({
    access_token: 'new-access', refresh_token: 'new-refresh', created_at: 200, expires_in: 86400
  });
  const auth = loadAuth(storage, request);

  await auth.refresh('id', 'secret');

  expect(storage.data[config.STORAGE_KEYS.experimentalToken]).toBe('new-access');
  expect(storage.data[config.STORAGE_KEYS.refreshToken]).toBe('new-refresh');
});

test('clearToken removes OAuth state but keeps unrelated storage', () => {
  const storage = makeStorage();
  storage.set(config.STORAGE_KEYS.refreshToken, 'refresh');
  storage.set(config.STORAGE_KEYS.mappings, 'keep');
  const auth = loadAuth(storage, jest.fn());

  auth.clearToken();

  expect(storage.data[config.STORAGE_KEYS.refreshToken]).toBe('');
  expect(storage.data[config.STORAGE_KEYS.mappings]).toBe('keep');
});
