const cache = require('../src/cache');

describe('cache', () => {
  beforeEach(() => cache.clear());

  test('stores and retrieves value', () => {
    cache.set('type', 'key', 'value');
    const hit = cache.get('type', 'key', 60000);
    expect(hit.hit).toBe(true);
    expect(hit.data).toBe('value');
  });

  test('returns stale for expired entry', async () => {
    cache.set('type', 'key', 'value');
    await new Promise(r => setTimeout(r, 5));
    const hit = cache.get('type', 'key', 1);
    expect(hit.hit).toBe(false);
    expect(hit.stale).toBe(true);
    expect(hit.data).toBe('value');
  });
});
