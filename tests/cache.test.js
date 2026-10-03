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

  test('rejects malformed entries and expires at the TTL boundary or clock rollback', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      const key = require('../src/config').STORAGE_KEYS.cache;
      global.__test_storage.set(key, JSON.stringify({ v: 1, items: { 'type:missing': { t: 1000 } } }));
      expect(cache.get('type', 'missing', 100).hit).toBe(false);
      cache.set('type', 'key', 'value');
      now.mockReturnValue(1100);
      expect(cache.get('type', 'key', 100)).toMatchObject({ hit: false, stale: true });
      now.mockReturnValue(999);
      expect(cache.get('type', 'key', 100)).toMatchObject({ hit: false, stale: true });
    } finally { now.mockRestore(); }
  });
});
