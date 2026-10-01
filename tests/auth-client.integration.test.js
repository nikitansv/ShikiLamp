const config = require('../src/config');

let auth;
let client;
let data;
let network;
const originalLampa = global.Lampa;
const originalFetch = global.fetch;
const keys = config.STORAGE_KEYS;

function tick() { return new Promise(resolve => setImmediate(resolve)); }
function bundle() {
  return { access_token: 'new-access', refresh_token: 'new-refresh',
    created_at: Math.floor(Date.now() / 1000), expires_in: 86400 };
}

beforeEach(() => {
  jest.resetModules();
  jest.unmock('../src/auth');
  jest.unmock('../src/api/client');
  data = {
    [keys.experimentalToken]: 'old-access',
    [keys.refreshToken]: 'old-refresh',
    [keys.tokenExpiresAt]: Math.floor(Date.now() / 1000) + 3600,
    [keys.oauthClientId]: 'fixture-id',
    [keys.oauthClientSecret]: 'fixture-secret',
    [keys.authUser]: { id: 7 }
  };
  network = { quiet: jest.fn() };
  global.fetch = undefined;
  global.Lampa = { Network: network, Storage: {
    get: (key, fallback) => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback,
    set: (key, value) => { data[key] = value; }
  } };
  auth = require('../src/auth');
  client = require('../src/api/client');
});

afterEach(async () => {
  client.cancelAll();
  await tick();
  global.Lampa = originalLampa;
  global.fetch = originalFetch;
});

test('three concurrent 401s share a refresh outside the occupied queue and resume queued work', async () => {
  const failures = [];
  let completeRefresh;
  network.quiet.mockImplementation((url, done, fail, body, params) => {
    if (url.endsWith('/oauth/token')) completeRefresh = done;
    else if (params.headers.Authorization === 'Bearer old-access') failures.push(fail);
    else done({ ok: true });
  });
  const requests = [1, 2, 3, 4].map(id => client.request('/api/test/' + id,
    { authenticated: true, skipCache: true }));
  await tick();
  expect(failures).toHaveLength(3);
  failures.forEach(fail => fail({ status: 401 }));
  await tick();
  expect(typeof completeRefresh).toBe('function');
  expect(network.quiet.mock.calls.filter(call => call[0].endsWith('/oauth/token'))).toHaveLength(1);
  completeRefresh(bundle());
  await expect(Promise.all(requests)).resolves.toEqual(Array(4).fill({ ok: true }));
  expect(auth.getRefreshToken()).toBe('new-refresh');
  expect(auth.getCachedUser()).toEqual({ id: 7 });
});

test('proactive refresh runs when the regular queue is full', async () => {
  const complete = [];
  let completeRefresh;
  network.quiet.mockImplementation((url, done) => {
    if (url.endsWith('/oauth/token')) completeRefresh = done;
    else complete.push(done);
  });
  const busy = [1, 2, 3].map(id => client.request('/api/public/' + id));
  data[keys.tokenExpiresAt] = 1;
  const refresh = auth.ensureValidToken(false);
  expect(typeof completeRefresh).toBe('function');
  completeRefresh(bundle());
  await expect(refresh).resolves.toBe('new-access');
  complete.forEach(done => done({}));
  await Promise.all(busy);
});

test.each([
  [400, 'Bad request'], [401, 'Unauthorized'], [403, 'Temporary gateway denial'],
  [401, '{"error":"invalid_client"}'], [400, 'Page mentions invalid_grant without an OAuth response']
])('refresh failure %s/%s preserves the token pair and user', async (status, message) => {
  network.quiet.mockImplementation((url, done, fail) => fail({ status, decode_error: message }));
  await expect(auth.ensureValidToken(true)).rejects.toMatchObject({ status });
  expect(auth.getToken()).toBe('old-access');
  expect(auth.getRefreshToken()).toBe('old-refresh');
  expect(auth.getCachedUser()).toEqual({ id: 7 });
});

test('a confirmed invalid_grant clears the rejected OAuth session', async () => {
  network.quiet.mockImplementation((url, done, fail) => fail({
    status: 400, responseJSON: { error: 'invalid_grant' }
  }));
  await expect(auth.ensureValidToken(true)).rejects.toMatchObject({ oauthError: 'invalid_grant' });
  expect(auth.getToken()).toBe('');
  expect(auth.getRefreshToken()).toBe('');
  expect(auth.getCachedUser()).toBeNull();
});

test('fetch OAuth errors retain their structured code', async () => {
  global.Lampa.Network = null;
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400,
    text: () => Promise.resolve('{"error":"invalid_grant"}') });
  await expect(auth.ensureValidToken(true)).rejects.toMatchObject({ oauthError: 'invalid_grant' });
  expect(auth.getToken()).toBe('');
});

test('manual token replacement removes old OAuth state and sends the new token without refresh', async () => {
  data[keys.tokenExpiresAt] = 1;
  auth.setToken('manual-access');
  expect(auth.getRefreshToken()).toBe('');
  expect(auth.getExpiresAt()).toBe(0);
  expect(auth.getCachedUser()).toBeNull();
  network.quiet.mockImplementation((url, done, fail, body, params) => {
    expect(params.headers.Authorization).toBe('Bearer manual-access');
    done({ ok: true });
  });
  await expect(client.request('/api/test', { authenticated: true })).resolves.toEqual({ ok: true });
  expect(network.quiet).toHaveBeenCalledTimes(1);
});

test('missing refresh credentials does not delete the manual token', async () => {
  auth.setToken('manual-access');
  await expect(auth.ensureValidToken(true)).rejects.toThrow('Данные OAuth refresh отсутствуют');
  expect(auth.getToken()).toBe('manual-access');
  expect(network.quiet).not.toHaveBeenCalled();
});

test.each(['logout', 'replace'])('late successful refresh cannot restore the previous session after %s', async action => {
  let completeRefresh;
  network.quiet.mockImplementation((url, done) => { completeRefresh = done; });
  const refresh = auth.ensureValidToken(true);
  const rejected = expect(refresh).rejects.toThrow('AUTH_SESSION_CHANGED');
  if (action === 'logout') auth.clearToken();
  else auth.setToken('manual-access');
  completeRefresh(bundle());
  await rejected;
  expect(auth.getToken()).toBe(action === 'logout' ? '' : 'manual-access');
  expect(auth.getRefreshToken()).toBe('');
});

test('late invalid_grant from an old refresh cannot clear the replacement token', async () => {
  let failRefresh;
  network.quiet.mockImplementation((url, done, fail) => { failRefresh = fail; });
  const refresh = auth.ensureValidToken(true);
  const rejected = expect(refresh).rejects.toMatchObject({ oauthError: 'invalid_grant' });
  auth.setToken('manual-access');
  failRefresh({ status: 400, responseText: '{"error":"invalid_grant"}' });
  await rejected;
  expect(auth.getToken()).toBe('manual-access');
});
