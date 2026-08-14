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

test('filter portals to body above Lampa UI', () => {
  const filter = new Filter();
  filter.create();
  const activity = document.createElement('div');
  activity.appendChild(filter.html);

  filter.beforeStart();

  expect(filter.html.parentNode).toBe(document.body);
  expect(filter.html.classList.contains('shikimori-filter-activity')).toBe(true);
});

test('filter portal hides while another activity is open', () => {
  const filter = new Filter();
  filter.create();
  filter.beforeStart();

  filter.pause();
  expect(filter.html.style.display).toBe('none');

  filter.beforeStart();
  expect(filter.html.style.display).toBe('');
});

test('filter portal hides for Lampa menu and returns with content', () => {
  const filter = new Filter();
  filter.create();

  filter.onMenuOpen();
  expect(filter.html.style.display).toBe('');
  expect(filter.html.classList.contains('menu-open')).toBe(true);

  filter.onContentShow();
  expect(filter.html.style.display).toBe('');
  expect(filter.html.classList.contains('menu-open')).toBe(false);
});

test('filter field opens options and Back returns to main panel', () => {
  const filter = new Filter();
  filter.create();
  filter.refocus = jest.fn();

  filter.selectField('kind');
  expect(filter.html.querySelectorAll('.shikimori-local__filter-option')).toHaveLength(6);
  expect(filter.pendingFocus.classList.contains('shikimori-local__filter-option')).toBe(true);
  expect(filter.onBack()).toBe(true);
  expect(filter.html.querySelector('.shikimori-local__filter-fields')).not.toBeNull();
  expect(filter.pendingFocus.getAttribute('data-field')).toBe('kind');
  expect(filter.onBack()).toBe(false);
});
