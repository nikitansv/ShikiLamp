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

test('refreshes before access token expiry', async () => {
  const storage = makeStorage();
  storage.set(config.STORAGE_KEYS.experimentalToken, 'old-access');
  storage.set(config.STORAGE_KEYS.refreshToken, 'old-refresh');
  storage.set(config.STORAGE_KEYS.tokenExpiresAt, 240);
  const request = jest.fn().mockResolvedValue({
    access_token: 'new-access', refresh_token: 'new-refresh', created_at: 200, expires_in: 86400
  });
  const auth = loadAuth(storage, request);
  const now = Date.now;
  Date.now = () => 200000;

  await expect(auth.ensureValidToken(false)).resolves.toBe('new-access');
  expect(request).toHaveBeenCalledTimes(1);

  Date.now = now;
});

test('shares one refresh between concurrent requests', async () => {
  const storage = makeStorage();
  storage.set(config.STORAGE_KEYS.experimentalToken, 'old-access');
  storage.set(config.STORAGE_KEYS.refreshToken, 'old-refresh');
  storage.set(config.STORAGE_KEYS.tokenExpiresAt, 240);
  let resolveRequest;
  const request = jest.fn().mockImplementation(() => new Promise(resolve => { resolveRequest = resolve; }));
  const auth = loadAuth(storage, request);
  const now = Date.now;
  Date.now = () => 200000;

  const first = auth.ensureValidToken(false);
  const second = auth.ensureValidToken(false);
  expect(request).toHaveBeenCalledTimes(1);

  resolveRequest({ access_token: 'new-access', refresh_token: 'new-refresh', created_at: 200, expires_in: 86400 });
  await expect(Promise.all([first, second])).resolves.toEqual(['new-access', 'new-access']);

  Date.now = now;
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

test('whoami rejects a response from a session cleared during the request', async () => {
  const storage = makeStorage();
  storage.set(config.STORAGE_KEYS.experimentalToken, 'access');
  let complete;
  const auth = loadAuth(storage, () => new Promise(resolve => { complete = resolve; }));
  const pending = auth.check();
  auth.clearToken();
  complete({ id: 7 });
  await expect(pending).rejects.toThrow('AUTH_SESSION_CHANGED');
  expect(auth.getCachedUser()).toBeNull();
});

test('invalid token bundles cannot overwrite a working token pair', async () => {
  const storage = makeStorage();
  storage.set(config.STORAGE_KEYS.experimentalToken, 'access');
  storage.set(config.STORAGE_KEYS.refreshToken, 'refresh');
  const auth = loadAuth(storage, jest.fn().mockResolvedValue({ access_token: '  ', refresh_token: 'new' }));
  await expect(auth.refresh('id', 'secret')).rejects.toThrow('Некорректный token response Shikimori');
  expect(auth.getToken()).toBe('access');
  expect(auth.getRefreshToken()).toBe('refresh');
});

test('a superseded code exchange cannot overwrite the newest login', async () => {
  const storage = makeStorage();
  const complete = [];
  const request = jest.fn((path) => path === '/oauth/token'
    ? new Promise(resolve => complete.push(resolve)) : Promise.resolve({ id: 8 }));
  const auth = loadAuth(storage, request);
  const first = auth.exchangeCode('first', 'id', 'secret');
  const rejected = expect(first).rejects.toThrow('AUTH_SESSION_CHANGED');
  const second = auth.exchangeCode('second', 'id', 'secret');
  complete[1]({ access_token: 'second', refresh_token: 'second-refresh' });
  await expect(second).resolves.toEqual({ id: 8 });
  complete[0]({ access_token: 'first', refresh_token: 'first-refresh' });
  await rejected;
  expect(auth.getToken()).toBe('second');
  expect(auth.getCachedUser()).toEqual({ id: 8 });
});

test.each(['invalid code', 'network failure', 'malformed bundle'])('failed replacement login preserves the existing session: %s', async failure => {
  const storage = makeStorage();
  storage.set(config.STORAGE_KEYS.experimentalToken, 'existing-access');
  storage.set(config.STORAGE_KEYS.refreshToken, 'existing-refresh');
  storage.set(config.STORAGE_KEYS.tokenExpiresAt, 12345);
  storage.set(config.STORAGE_KEYS.authUser, { id: 7 });
  storage.set(config.STORAGE_KEYS.authCheckedAt, 6789);
  const before = { ...storage.data };
  const request = jest.fn();
  if (failure === 'malformed bundle') request.mockResolvedValue({ access_token: ' ', refresh_token: 'new' });
  else request.mockRejectedValue(new Error(failure));
  const auth = loadAuth(storage, request);
  await expect(auth.exchangeCode('replacement-code', 'id', 'secret')).rejects.toThrow();
  expect(storage.data).toEqual(before);
});

test('successful replacement clears old user only after validation and rejects old checks', async () => {
  const storage = makeStorage();
  storage.set(config.STORAGE_KEYS.experimentalToken, 'existing-access');
  storage.set(config.STORAGE_KEYS.authUser, { id: 7 });
  const pending = [];
  const request = jest.fn(() => new Promise(resolve => pending.push(resolve)));
  const auth = loadAuth(storage, request);
  const exchange = auth.exchangeCode('code', 'id', 'secret');
  expect(auth.getToken()).toBe('existing-access');
  expect(auth.getCachedUser()).toEqual({ id: 7 });
  const oldCheck = auth.check();
  const rejected = expect(oldCheck).rejects.toThrow('AUTH_SESSION_CHANGED');
  pending[0]({ access_token: 'new-access', refresh_token: 'new-refresh' });
  await Promise.resolve();
  expect(auth.getToken()).toBe('new-access');
  expect(auth.getCachedUser()).toBeNull();
  pending[1]({ id: 7 });
  await rejected;
  pending[2]({ id: 8 });
  await expect(exchange).resolves.toEqual({ id: 8 });
  expect(auth.getCachedUser()).toEqual({ id: 8 });
});
