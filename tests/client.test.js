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
  let storedToken = 'old-token';
  global.Lampa = {
    Storage: {
      get: (key, fallback) => key === 'shikimori_local_experimental_token' ? storedToken : fallback
    }
  };
  mockAuth.ensureValidToken.mockImplementation(force => {
    if (force) storedToken = 'new-token';
    return Promise.resolve(storedToken);
  });
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
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer old-token');
  expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer new-token');
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

test('cancels active and queued requests without leaving the queue stuck', async () => {
  global.fetch.mockImplementation(() => new Promise(() => {}));

  const client = loadClient();
  const first = client.request('/api/one');
  const second = client.request('/api/two');
  const third = client.request('/api/three');
  const fourth = client.request('/api/four');

  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(first.cancel()).toBe(true);
  await expect(first).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  expect(global.fetch).toHaveBeenCalledTimes(4);

  client.cancelAll();
  await expect(second).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  await expect(third).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
  await expect(fourth).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' });
});
