const { JSDOM } = require('jsdom');
const lifecycle = require('../src/components/lifecycle');
const Anime = require('../src/components/anime');
const Mapping = require('../src/components/mapping');
const Mappings = require('../src/components/mappings');
const matcher = require('../src/mapping/matcher');
const storage = require('../src/mapping/storage');
const menu = require('../src/ui/menu');
const Line = require('../src/components/line');
const Filter = require('../src/components/filter');

let controllers;
let current;
let instance;
let dom;

function screen(markup) {
  function Screen() { this.html = document.createElement('div'); this.html.innerHTML = markup; }
  lifecycle.attachLifecycle(Screen);
  instance = new Screen();
  document.body.appendChild(instance.html);
  instance.start();
  return instance;
}

beforeEach(() => {
  jest.useFakeTimers();
  dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.Event = dom.window.Event;
  global.requestAnimationFrame = callback => setTimeout(callback, 16);
  global.cancelAnimationFrame = clearTimeout;
  window.requestAnimationFrame = global.requestAnimationFrame;
  window.cancelAnimationFrame = global.cancelAnimationFrame;
  controllers = {};
  current = 'content';
  const stored = {};
  global.Lampa = window.Lampa = {
    Activity: { backward: jest.fn(), push: jest.fn() },
    Storage: {
      get: (key, fallback) => Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : fallback,
      set: (key, value) => { stored[key] = value; }
    },
    Controller: {
      add: jest.fn((name, controller) => { controllers[name] = controller; }),
      enabled: () => ({ name: current }),
      toggle: jest.fn(name => {
        if (controllers[current] && controllers[current].gone) controllers[current].gone(name);
        current = name;
        if (controllers[name] && controllers[name].toggle) controllers[name].toggle();
      }),
      collectionSet: jest.fn(html => html.querySelectorAll('.focus').forEach(el => el.classList.remove('focus'))),
      collectionFocus: jest.fn(el => {
        el.dispatchEvent(new window.Event('hover:focus'));
        el.classList.add('focus');
      })
    }
  };
});

afterEach(() => {
  if (instance) instance.destroy();
  require('../src/ui/motion').stop(document.body);
  instance = null;
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  dom.window.close();
  delete global.Lampa;
  delete global.window;
  delete global.document;
  delete global.Event;
  delete global.requestAnimationFrame;
  delete global.cancelAnimationFrame;
});

test('Back restores the previous selection and both scroll positions after host clears focus', () => {
  const page = screen('<div class="shikimori-local"><div class="shikimori-local__row-items"><div class="selector">first</div><div class="selector">second</div></div></div>');
  const second = page.html.querySelectorAll('.selector')[1];
  lifecycle.refocus(page, second);
  const root = page.html.firstElementChild;
  const rail = root.firstElementChild;
  Object.defineProperties(root, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } });
  Object.defineProperties(rail, { scrollWidth: { value: 1000 }, clientWidth: { value: 200 } });
  root.scrollTop = 240;
  rail.scrollLeft = 420;
  page.pause();
  second.classList.remove('focus');
  root.scrollTop = 0;
  rail.scrollLeft = 0;
  page.start();
  jest.advanceTimersByTime(20);
  expect(Lampa.Controller.collectionFocus).toHaveBeenLastCalledWith(second, page.html, true);
  expect(root.scrollTop).toBe(240);
  expect(rail.scrollLeft).toBe(420);
});

test('late refresh of paused content cannot replace the new page collection', () => {
  const page = screen('<div class="shikimori-local"><div class="selector">first</div></div>');
  page.pause();
  Lampa.Controller.collectionSet.mockClear();
  lifecycle.refocus(page);
  jest.runOnlyPendingTimers();
  expect(Lampa.Controller.collectionSet).not.toHaveBeenCalled();
});

test('menu and modal controllers keep focus while content loads', () => {
  const page = screen('<div class="shikimori-local"><div class="selector">first</div></div>');
  Lampa.Controller.toggle('menu');
  Lampa.Controller.collectionSet.mockClear();
  lifecycle.refocus(page);
  jest.runOnlyPendingTimers();
  expect(Lampa.Controller.collectionSet).not.toHaveBeenCalled();
});

test('focus updates do not schedule later forced selection of an old card', () => {
  const page = screen('<div class="shikimori-local"><div class="selector">first</div><div class="selector">second</div></div>');
  const [first, second] = page.html.querySelectorAll('.selector');
  lifecycle.refocus(page, first);
  lifecycle.refocus(page, second);
  Lampa.Controller.collectionFocus.mockClear();
  jest.advanceTimersByTime(200);
  expect(Lampa.Controller.collectionFocus).not.toHaveBeenCalled();
  expect(second.classList.contains('focus')).toBe(true);
});

test('focus scrolling respects rail padding so the focus outline is not clipped', () => {
  const page = screen('<div class="shikimori-local"><div class="shikimori-local__row-items"><div class="selector">card</div></div></div>');
  const rail = page.html.querySelector('.shikimori-local__row-items');
  const card = rail.firstElementChild;
  rail.style.scrollPaddingLeft = rail.style.scrollPaddingRight = '24px';
  Object.defineProperties(rail, { scrollWidth: { value: 1400 }, clientWidth: { value: 600 } });
  rail.scrollLeft = 50;
  rail.getBoundingClientRect = () => ({ left: 0, right: 600, top: 0, bottom: 400 });
  card.getBoundingClientRect = () => ({ left: 800, right: 1000, top: 0, bottom: 300 });
  lifecycle.refocus(page, card);
  jest.advanceTimersByTime(300);
  expect(rail.scrollLeft).toBe(474);
  expect(rail.scrollTop).toBe(0);
});

test('rerender preserves selected action before collectionSet clears focus', () => {
  const page = screen('<div class="shikimori-local"><div class="selector" data-action="first">first</div><div class="selector" data-action="second">second</div></div>');
  lifecycle.refocus(page, page.html.querySelector('[data-action="second"]'));
  lifecycle.rememberFocus(page);
  page.html.innerHTML = '<div class="shikimori-local"><div class="selector" data-action="first">first</div><div class="selector" data-action="second">second</div></div>';
  lifecycle.refocus(page);
  expect(page.html.querySelector('[data-action="second"]').classList.contains('focus')).toBe(true);
});

test('inherited lifecycle registers content only once', () => {
  function Parent() { this.html = document.createElement('div'); }
  lifecycle.attachLifecycle(Parent);
  function Child() { Parent.call(this); }
  Child.prototype = Object.create(Parent.prototype);
  lifecycle.attachLifecycle(Child);
  instance = new Child();
  instance.start();
  expect(Lampa.Controller.add).toHaveBeenCalledTimes(1);
});

test('an unbound click and a Lampa-translated click each run one action', () => {
  const el = document.createElement('div');
  const action = jest.fn();
  lifecycle.bindAction(el, action);
  el.click();
  expect(action).toHaveBeenCalledTimes(1);
  action.mockClear();
  el.bind_events = true;
  el.click();
  el.dispatchEvent(new window.Event('hover:enter'));
  expect(action).toHaveBeenCalledTimes(1);
});

test('menu registration and menu start do not attach duplicate enter handlers', () => {
  const settings = require('../src/settings');
  jest.spyOn(settings, 'showMenu').mockReturnValue(true);
  jest.spyOn(settings, 'isEnabled').mockReturnValue(true);
  let onMenu;
  Lampa.Listener = { follow: (name, callback) => { onMenu = callback; } };
  document.body.innerHTML = '<div class="menu__list"></div>';
  menu.register();
  onMenu({ type: 'start' });
  onMenu({ type: 'start' });
  document.querySelector('.shikimori-local-menu-item').dispatchEvent(new window.Event('hover:enter'));
  expect(Lampa.Activity.push).toHaveBeenCalledTimes(1);
});

test('Back closes a detail dropdown and restores its button before leaving the page', () => {
  const anime = new Anime({ anime: { title: 'Fixture', shikimori_id: 1, episodes: 12 } });
  anime.html = document.createElement('div');
  anime.html.innerHTML = require('../src/ui/templates').animeTemplate(anime.anime);
  document.body.appendChild(anime.html);
  anime.toggleMenu('status-menu');
  expect(anime.onBack()).toBe(true);
  expect(anime.html.querySelector('.shikimori-local__dropdown.open')).toBeNull();
  expect(anime.html.querySelector('[data-action="toggle-status-menu"]').classList.contains('focus')).toBe(true);
  expect(anime.onBack()).toBe(false);
  expect(Lampa.Activity.backward).not.toHaveBeenCalled();
});

test('direction keys on edit buttons allow navigation without submitting rate changes', () => {
  const anime = new Anime({ anime: { rate_id: 1, user_score: 5, episodes: 12 } });
  const update = jest.spyOn(require('../src/api/user'), 'updateAnimeRate');
  for (const action of ['toggle-score-menu', 'set-episodes']) {
    const button = document.createElement('div');
    button.dataset.action = action;
    expect(anime.onUp(button)).toBe(false);
    expect(anime.onDown(button)).toBe(false);
  }
  expect(update).not.toHaveBeenCalled();
});

test('saving a mapping leaves the newly opened TMDB page on top', () => {
  jest.spyOn(matcher, 'saveManual').mockReturnValue({ tmdb_id: 10 });
  jest.spyOn(matcher, 'openLampaCard').mockReturnValue(true);
  const mapping = new Mapping({ anime: { shikimori_id: 1 } });
  mapping.save(10, 'tv', 1, 0);
  expect(matcher.openLampaCard).toHaveBeenCalledTimes(1);
  expect(Lampa.Activity.backward).not.toHaveBeenCalled();
});

test('mappings render returns the activity DOM without recreating it', () => {
  jest.spyOn(storage, 'list').mockReturnValue([]);
  const mappings = new Mappings();
  mappings.create();
  expect(mappings.render()).toBe(mappings.html);
  expect(mappings.render()).toBe(mappings.html);
});

test('repeated Enter shares pending card lookup and cannot reopen a page after Back', async () => {
  let resolve;
  jest.spyOn(matcher, 'openConfident').mockImplementation(() => new Promise(done => { resolve = done; }));
  const line = new Line();
  line.html = document.createElement('div');
  line.openAnime({ shikimori_id: 1 });
  line.openAnime({ shikimori_id: 1 });
  expect(matcher.openConfident).toHaveBeenCalledTimes(1);
  line.__shikimoriActive = false;
  resolve(false);
  await Promise.resolve();
  expect(Lampa.Activity.push).not.toHaveBeenCalled();
});

test('a completed TMDB lookup honors the navigation guard before opening a card', async () => {
  storage.set({ shikimori_id: 111, tmdb_id: 222, tmdb_type: 'tv', tmdb_season: 1 });
  expect(storage.get(111).tmdb_id).toBe(222);
  await expect(matcher.openBestOrFirst({ shikimori_id: 111, title: 'Fixture' }, () => false)).resolves.toBe(false);
  expect(Lampa.Activity.push).not.toHaveBeenCalled();
});

test('collapsed filter panel is excluded from the navigation collection', () => {
  const filter = new Filter();
  filter.html = document.createElement('div');
  filter.html.innerHTML = '<div class="shikimori-local"><div class="shikimori-local__filter-main"><div class="selector">card</div></div><div class="shikimori-local__filter-panel"><div class="selector">hidden option</div></div></div>';
  filter.panelHidden = true;
  document.body.appendChild(filter.html);
  lifecycle.refocus(filter);
  expect(Lampa.Controller.collectionSet).toHaveBeenLastCalledWith(filter.html.querySelector('.shikimori-local__filter-main'), false, true);
  expect(filter.html.querySelector('.shikimori-local__filter-panel .focus')).toBeNull();
});

test('destroy cancels pending focus scrolling', () => {
  const page = screen('<div class="shikimori-local"><div class="selector">first</div></div>');
  const frame = page.__shikimoriFocusFrame;
  const cancel = jest.spyOn(global, 'cancelAnimationFrame');
  expect(frame).not.toBeNull();
  page.destroy();
  expect(cancel).toHaveBeenCalledWith(frame);
  expect(page.__shikimoriFocusFrame).toBeNull();
});

test('late poster loading leaves the open menu and page DOM intact', async () => {
  let finish;
  jest.spyOn(matcher, 'applyBestPoster').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const anime = new Anime({ anime: { title: 'Fixture', shikimori_id: 1 } });
  anime.create();
  document.body.appendChild(anime.html);
  anime.toggleMenu('status-menu');
  const page = anime.html.firstElementChild;
  const dropdown = anime.html.querySelector('.shikimori-local__dropdown.open');
  anime.anime.poster = 'https://example.com/poster.jpg';
  finish(anime.anime); await Promise.resolve();
  expect(anime.html.firstElementChild).toBe(page);
  expect(anime.html.querySelector('.shikimori-local__dropdown.open')).toBe(dropdown);
  expect(anime.html.querySelector('.shikimori-local__poster img').src).toBe(anime.anime.poster);
});
