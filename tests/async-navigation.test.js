const { JSDOM } = require('jsdom');
const UserLists = require('../src/components/userlists');
const Filter = require('../src/components/filter');
const Search = require('../src/components/search');
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
