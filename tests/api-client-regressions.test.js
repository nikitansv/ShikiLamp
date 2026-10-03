const config = require('../src/config');
const keys = config.STORAGE_KEYS;
const originalLampa = global.Lampa;
const originalFetch = global.fetch;
const originalAbortController = global.AbortController;
let client;
let auth;
let network;
let data;
let requests;

function tick() { return new Promise(resolve => setImmediate(resolve)); }
function request(path, options) {
  const promise = client.request(path, options);
  promise.catch(() => {});
  requests.push(promise);
  return promise;
}

beforeEach(() => {
  jest.resetModules();
  jest.unmock('../src/auth');
  jest.unmock('../src/api/client');
  data = { [keys.experimentalToken]: 'access', [keys.authUser]: { id: 7 },
    [keys.oauthClientId]: 'fixture-id', [keys.oauthClientSecret]: 'fixture-secret' };
  network = { quiet: jest.fn() };
  global.fetch = undefined;
  global.Lampa = { Network: network, Storage: {
    get: (key, fallback) => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback,
    set: (key, value) => { data[key] = value; }
  } };
  client = require('../src/api/client');
  auth = require('../src/auth');
  requests = [];
});

afterEach(async () => {
  client.cancelAll();
  await Promise.allSettled(requests);
  jest.useRealTimers();
  global.Lampa = originalLampa;
  global.fetch = originalFetch;
  global.AbortController = originalAbortController;
});

test('cancelled queued jobs never consume concurrency slots', async () => {
  const active = [1, 2, 3].map(id => request('/active/' + id));
  const cancelled = [1, 2, 3].map(id => request('/cancelled/' + id));
  cancelled.forEach(promise => promise.cancel());
  request('/next');
  network.quiet.mock.calls.slice().forEach(call => call[1]({}));
  await Promise.all(active);
  expect(network.quiet.mock.calls.map(call => call[0].split('/').pop())).toEqual(['1', '2', '3', 'next']);
});

test.each(['logout', 'replace'])('late whoami cannot restore the old user after %s', async action => {
  const check = auth.check();
  requests.push(check);
  const rejected = expect(check).rejects.toThrow('AUTH_SESSION_CHANGED');
  await tick();
  if (action === 'logout') auth.clearToken();
  else auth.setToken('replacement');
  network.quiet.mock.calls[0][1]({ id: 7 });
  await rejected;
  expect(auth.getCachedUser()).toBeNull();
});

test('queued authenticated writes cannot run as a replacement user', async () => {
  [1, 2, 3].forEach(id => request('/active/' + id));
  const write = request('/api/v2/user_rates/42', { method: 'PATCH', body: { score: 8 }, authenticated: true });
  const rejected = expect(write).rejects.toThrow('AUTH_SESSION_CHANGED');
  auth.setToken('replacement');
  network.quiet.mock.calls[0][1]({});
  await rejected;
  expect(network.quiet).toHaveBeenCalledTimes(3);
});

test('late 401 reuses an already refreshed token', async () => {
  data[keys.refreshToken] = 'refresh';
  network.quiet.mockImplementation((url, done, fail, body, params) => {
    if (url.endsWith('/oauth/token')) done({ access_token: 'rotated', refresh_token: 'rotated-refresh', expires_in: 86400 });
    else if (params.headers.Authorization === 'Bearer rotated') done({ ok: true });
  });
  const first = request('/first', { authenticated: true });
  const second = request('/second', { authenticated: true });
  await tick();
  const failures = network.quiet.mock.calls.slice().map(call => call[2]);
  failures[0]({ status: 401 });
  await first;
  failures[1]({ status: 401 });
  await second;
  expect(network.quiet.mock.calls.filter(call => call[0].endsWith('/oauth/token')).length).toBe(1);
});

test('authenticated responses cannot leak through the public response cache', async () => {
  network.quiet.mockImplementation((url, done) => done({ user: auth.getToken() }));
  await request('/api/private', { authenticated: true, cacheTtl: 60000 });
  auth.setToken('replacement');
  await expect(request('/api/private', { authenticated: true, cacheTtl: 60000 })).resolves.toEqual({ user: 'replacement' });
  expect(require('../src/cache').size()).toBe(0);
});

test('changing API host does not reuse another host response', async () => {
  network.quiet.mockImplementation((url, done) => done({ url }));
  await request('/api/public', { cacheTtl: 60000 });
  data[keys.apiBaseUrl] = 'https://example.test';
  await expect(request('/api/public', { cacheTtl: 60000 })).resolves.toEqual({ url: 'https://example.test/api/public' });
});

test('GraphQL error responses are not cached', async () => {
  network.quiet.mockImplementationOnce((url, done) => done({ errors: [{ message: 'Temporary failure' }] }))
    .mockImplementationOnce((url, done) => done({ data: { animes: [] } }));
  const options = { method: 'POST', body: { query: '{ animes { id } }' }, cacheTtl: 60000 };
  await request('/api/graphql', options);
  await expect(request('/api/graphql', options)).resolves.toEqual({ data: { animes: [] } });
});

test('fetch times out stalled response bodies and exhausts bounded retries', async () => {
  jest.useFakeTimers();
  global.Lampa.Network = null;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: () => new Promise(() => {}) });
  const pending = request('/api/slow', { timeout: 10 });
  const rejected = expect(pending).rejects.toMatchObject({ status: 408 });
  await jest.advanceTimersByTimeAsync(3040);
  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(global.fetch.mock.calls.every(call => call[1].signal.aborted)).toBe(true);
  await rejected;
});

test('cancelling a retry prevents further network calls', async () => {
  jest.useFakeTimers();
  network.quiet.mockImplementation((url, done, fail) => fail({ status: 503 }));
  const pending = request('/api/retry');
  pending.cancel();
  await expect(pending).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  await jest.advanceTimersByTimeAsync(5000);
  expect(network.quiet).toHaveBeenCalledTimes(1);
});

test('public cached responses remain reusable until their TTL expires', async () => {
  jest.useFakeTimers();
  network.quiet.mockImplementation((url, done) => done({ ok: true }));
  await request('/api/public', { cacheTtl: 100 });
  await expect(request('/api/public', { cacheTtl: 100 })).resolves.toEqual({ ok: true });
  expect(network.quiet).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(101);
  await request('/api/public', { cacheTtl: 100 });
  expect(network.quiet).toHaveBeenCalledTimes(2);
});

test('fetch cancellation still aborts while response body is pending', async () => {
  global.Lampa.Network = null;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: () => new Promise(() => {}) });
  const pending = request('/api/body', { method: 'POST', authenticated: true, body: {} });
  await tick();
  pending.cancel();
  await expect(pending).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  expect(global.fetch.mock.calls[0][1].signal.aborted).toBe(true);
});

test.each(['quiet', 'fetch', 'AbortController'])('synchronous %s exceptions exhaust retries and release every occupied slot', async transport => {
  jest.useFakeTimers();
  const throwing = jest.fn(() => { throw new Error('transport setup failed'); });
  if (transport === 'quiet') network.quiet = throwing;
  else {
    global.Lampa.Network = null;
    global.fetch = transport === 'fetch' ? throwing : jest.fn();
    if (transport === 'AbortController') global.AbortController = throwing;
  }
  const pending = [];
  expect(() => {
    for (let i = 0; i < 3; i++) pending.push(request('/broken/' + i));
  }).not.toThrow();
  const rejected = pending.map(promise => expect(promise).rejects.toMatchObject({ status: 0, message: 'transport setup failed' }));
  const next = request('/next');
  await jest.advanceTimersByTimeAsync(3000);
  await Promise.all(rejected);
  expect(throwing).toHaveBeenCalledTimes(10);
  expect(jest.getTimerCount()).toBe(1);
  if (transport === 'quiet') network.quiet = jest.fn((url, done) => done({ ok: true }));
  else {
    global.AbortController = originalAbortController;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('{"ok":true}') });
  }
  await jest.advanceTimersByTimeAsync(1000);
  await expect(next).resolves.toEqual({ ok: true });
  expect(jest.getTimerCount()).toBe(0);
});
