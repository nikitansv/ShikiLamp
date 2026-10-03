const { JSDOM } = require('jsdom');
const UserLists = require('../src/components/userlists');
const Filter = require('../src/components/filter');
const Search = require('../src/components/search');
const Line = require('../src/components/line');
const Mapping = require('../src/components/mapping');
const Anime = require('../src/components/anime');
const matcher = require('../src/mapping/matcher');
const userApi = require('../src/api/user');
const api = require('../src/api');
const auth = require('../src/auth');

let dom, screen;
const anime = title => ({ shikimori_id: 1, title, kind: 'tv' });
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function flush() { await Promise.resolve(); await Promise.resolve(); }

beforeEach(() => {
  dom = new JSDOM('<html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.Lampa = { Storage: { get: (_, fallback) => fallback, set: jest.fn() } };
  jest.spyOn(auth, 'getToken').mockReturnValue('fixture');
  jest.spyOn(auth, 'getCachedUser').mockReturnValue({ id: 1 });
  jest.spyOn(matcher, 'applyBestPoster').mockResolvedValue({});
});
afterEach(() => {
  if (screen) screen.destroy();
  screen = null;
  jest.restoreAllMocks();
  dom.window.close();
  delete global.window; delete global.document; delete global.Lampa;
});

test('rapid list changes keep the selected tab and ignore older result shapes', async () => {
  const requests = [deferred(), deferred(), deferred()];
  let call = 0;
  jest.spyOn(UserLists.prototype, 'loadListData').mockImplementation(() => requests[call++].promise);
  screen = new UserLists({ status: 'planned' }); screen.create();
  const tab = screen.html.querySelector('[data-tab="watching"]');
  screen.changeStatus('completed'); screen.changeStatus('watching');
  requests[2].resolve([{ id: 'ongoing', list: [anime('Current selection')] }]);
  await flush();
  requests[0].resolve([{ id: 'upcoming', list: [anime('Old planned')] }]);
  requests[1].resolve([anime('Old completed')]);
  await flush();
  expect(call).toBe(3);
  expect(screen.html.querySelector('[data-tab="watching"]')).toBe(tab);
  expect(tab.classList.contains('active')).toBe(true);
  expect(screen.results.textContent).toContain('Current selection');
  expect(screen.results.textContent).not.toContain('Old');
  expect(screen.loading).toBe(false);
});

test('applying filters during loading discards the previous catalog and probe', async () => {
  const old = deferred(), latest = deferred();
  jest.spyOn(api, 'catalog').mockReturnValue(Promise.resolve([]))
    .mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  screen = new Filter(); screen.create();
  screen.filters = { order: 'aired_on' }; screen.action('apply');
  latest.resolve([anime('Fresh catalog')]); await flush();
  old.resolve([anime('Old catalog')]); await flush();
  expect(screen.results.textContent).toContain('Fresh catalog');
  expect(screen.results.textContent).not.toContain('Old catalog');
  expect(screen.page).toBe(2);
  expect(screen.loading).toBe(false);
});

test('a new search replaces an in-flight query and ignores its late response', async () => {
  const old = deferred(), latest = deferred();
  jest.spyOn(api, 'search').mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  screen = new Search(); screen.create();
  screen.doSearch('old', false); screen.doSearch('new', false);
  latest.resolve([anime('New result')]); await flush();
  old.resolve([anime('Old result')]); await flush();
  expect(screen.results.textContent).toContain('New result');
  expect(screen.results.textContent).not.toContain('Old result');
  expect(screen.currentQuery).toBe('new');
  expect(screen.page).toBe(2);
});

test.each(['destroyed', 'paused'])('late input callbacks ignore a %s screen', state => {
  let submit;
  Lampa.Input = { edit: jest.fn((options, callback) => { submit = callback; }) };
  const search = jest.spyOn(api, 'search').mockResolvedValue([]);
  const tmdbSearch = jest.spyOn(matcher, 'searchTmdb').mockResolvedValue([]);
  const update = jest.spyOn(userApi, 'updateAnimeRate').mockResolvedValue({});
  for (const Component of [Search, Mapping, Anime]) {
    screen = new Component({ anime: { shikimori_id: 1, title: 'Fixture', rate_id: 2, episodes: 12 } });
    screen.create();
    if (Component === Search) screen.askSearch();
    else if (Component === Mapping) screen.changeQuery();
    else screen.askEpisodes();
    search.mockClear(); tmdbSearch.mockClear(); update.mockClear();
    if (state === 'destroyed') screen.destroy();
    else screen.__shikimoriActive = false;
    expect(() => submit('3')).not.toThrow();
    expect(search).not.toHaveBeenCalled();
    expect(tmdbSearch).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    screen.destroy(); screen = null;
  }
});

test('search More can retry the same page after a network failure', async () => {
  const search = jest.spyOn(api, 'search').mockResolvedValueOnce([anime('First')])
    .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([{ ...anime('Second'), shikimori_id: 2 }]);
  screen = new Search(); screen.create(); screen.doSearch('fixture', false); await flush();
  screen.results.querySelector('.shikimori-local__more').click(); await flush();
  expect(screen.results.querySelector('.shikimori-local__more')).not.toBeNull();
  screen.results.querySelector('.shikimori-local__more').click(); await flush();
  expect(search.mock.calls.map(call => call[1])).toEqual([1, 2, 2]);
  expect(screen.results.textContent).toContain('First');
  expect(screen.results.textContent).toContain('Second');
  expect(screen.results.querySelector('.shikimori-local__error')).toBeNull();
});

test('catalog More retries a failed probe and failed page without dropping cards', async () => {
  const popular = jest.spyOn(api, 'popular').mockResolvedValueOnce([anime('First')])
    .mockRejectedValueOnce(new Error('probe offline'))
    .mockRejectedValueOnce(new Error('page offline'))
    .mockResolvedValueOnce([{ ...anime('Second'), shikimori_id: 2 }]).mockResolvedValue([]);
  screen = new Line(); screen.create(); await flush();
  expect(screen.results.querySelector('.shikimori-local__more')).not.toBeNull();
  screen.results.querySelector('.shikimori-local__more').click(); await flush();
  expect(screen.results.querySelector('.shikimori-local__more')).not.toBeNull();
  screen.results.querySelector('.shikimori-local__more').click(); await flush();
  expect(popular.mock.calls.map(call => call[0])).toEqual([1, 2, 2, 2, 3]);
  expect(screen.results.textContent).toContain('First');
  expect(screen.results.textContent).toContain('Second');
  expect(screen.results.querySelector('.shikimori-local__error')).toBeNull();
});

test.each([Search, Line])('%p retries an initial failure from page one', async Component => {
  const loader = jest.spyOn(api, Component === Search ? 'search' : 'popular')
    .mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
  screen = new Component(); screen.create();
  if (Component === Search) screen.doSearch('fixture', false);
  await flush();
  const retry = screen.results.querySelector('.shikimori-local__more');
  expect(retry.textContent).toBe('Повторить');
  retry.click(); await flush();
  expect(loader.mock.calls.map(call => Component === Search ? call[1] : call[0])).toEqual([1, 1]);
  expect(screen.results.querySelector('.shikimori-local__error')).toBeNull();
  expect(screen.results.querySelector('.shikimori-local__empty')).not.toBeNull();
});
