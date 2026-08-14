const { JSDOM } = require('jsdom');

jest.mock('../src/api', () => ({
  catalog: jest.fn(() => Promise.resolve([
    { shikimori_id: 1, title: 'Ranked anime', score: 9, kind: 'tv' }
  ]))
}));

const api = require('../src/api');
const Filter = require('../src/components/filter');

beforeEach(() => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.Lampa = {
    Storage: { get: function (key, fallback) { return fallback; }, set: jest.fn() },
    Controller: { collectionSet: jest.fn(), collectionFocus: jest.fn() }
  };
});

afterEach(() => {
  delete global.Lampa;
  delete global.document;
  delete global.window;
  jest.clearAllMocks();
});

test('filter opens with ranked catalog and compact panel', async () => {
  const filter = new Filter();
  filter.create();
  await Promise.resolve();
  await Promise.resolve();

  expect(api.catalog).toHaveBeenCalledWith(expect.objectContaining({ order: 'ranked', page: 1 }));
  expect(filter.html.querySelector('.shikimori-local__filter-panel')).not.toBeNull();
  expect(filter.html.querySelector('.shikimori-local__result').__shikimoriAnime.title).toBe('Ranked anime');
});
