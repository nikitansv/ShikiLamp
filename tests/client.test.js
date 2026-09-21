const mockAuth = {
  ensureValidToken: jest.fn(() => Promise.resolve('token'))
};

function loadClient() {
  jest.resetModules();
  jest.doMock('../src/auth', () => mockAuth);
  return require('../src/api/client');
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body)
  };
}

beforeEach(() => {
  mockAuth.ensureValidToken.mockClear();
  global.fetch = jest.fn();
  delete global.Lampa;
});

afterEach(() => {
  jest.resetModules();
  delete global.fetch;
  delete global.Lampa;
});

test('refreshes and retries authenticated request once after 401', async () => {
  global.fetch
    .mockResolvedValueOnce(response(401, '{"error":"invalid_token"}'))
    .mockResolvedValueOnce(response(200, '{"ok":true}'));

  const client = loadClient();
  await expect(client.request('/api/test', {
    method: 'POST',
    authenticated: true,
    body: { value: 1 }
  })).resolves.toEqual({ ok: true });

  expect(mockAuth.ensureValidToken.mock.calls.map(call => call[0])).toEqual([false, true]);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('does not retry a second 401', async () => {
  global.fetch
    .mockResolvedValueOnce(response(401, 'expired'))
    .mockResolvedValueOnce(response(401, 'expired'));

  const client = loadClient();
  await expect(client.request('/api/test', {
    method: 'POST',
    authenticated: true,
    body: { value: 1 }
  })).rejects.toMatchObject({ status: 401 });

  expect(mockAuth.ensureValidToken.mock.calls.map(call => call[0])).toEqual([false, true]);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
