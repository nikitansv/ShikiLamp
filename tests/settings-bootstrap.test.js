const { JSDOM } = require('jsdom');

let dom, host, store, listeners, components, parameters, config, settings, menu, logger, styles;
function emit(type, event) { Array.from(listeners[type] || []).forEach(callback => callback(event)); }
function action(name) { return parameters.find(item => item.param.name === 'shikimori_local_action_' + name); }
function change(key, value) {
  const name = config.STORAGE_KEYS[key];
  host.Storage.set(name, value);
  parameters.find(item => item.param.name === name).onChange({ name, value });
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  dom = new JSDOM('<html><body><div class="menu__list"></div></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  store = {}; listeners = {}; components = {}; parameters = [];
  host = {
    Storage: {
      get: jest.fn((key, fallback) => Object.hasOwn(store, key) ? store[key] : fallback),
      set: jest.fn((key, value) => { store[key] = value; })
    },
    Listener: {
      follow: jest.fn((name, callback) => { (listeners[name] || (listeners[name] = new Set())).add(callback); }),
      remove: jest.fn((name, callback) => { if (listeners[name]) listeners[name].delete(callback); })
    },
    Component: { get: name => components[name], add: jest.fn((name, Component) => { components[name] = Component; }) },
    SettingsApi: {
      addComponent: jest.fn(), addParam: jest.fn(item => parameters.push(item)),
      removeComponent: jest.fn(), removeParams: jest.fn(component => { parameters = parameters.filter(item => item.component !== component); })
    },
    Activity: { push: jest.fn() }, Noty: { show: jest.fn() }, Input: { edit: jest.fn() }
  };
  global.Lampa = window.Lampa = host;
  jest.doMock('../src/ui/styles', () => ({ injectStyles: jest.fn(), applyUiSettings: jest.fn() }));
  config = require('../src/config'); settings = require('../src/settings'); menu = require('../src/ui/menu');
  logger = require('../src/logger'); styles = require('../src/ui/styles');
  jest.spyOn(logger, 'log').mockImplementation(() => {});
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
  jest.dontMock('../src/ui/styles');
  dom.window.close();
  delete global.window; delete global.document; delete global.Lampa; delete global.prompt;
});

test('bootstrap waits for ready, registers all screens once and removes its listener', () => {
  const plugin = require('../src/index');
  expect(host.Component.add).not.toHaveBeenCalled();
  emit('app', { type: 'start' });
  expect(host.Component.add).not.toHaveBeenCalled();
  window.appready = true; emit('app', { type: 'ready' });
  const names = ['home', 'anime', 'line', 'userlists', 'filter', 'mapping', 'mappings', 'diagnostics', 'search'];
  expect(Object.keys(components).sort()).toEqual(names.map(name => 'shikimori_local_' + name).sort());
  const count = parameters.length;
  plugin.init(); emit('app', { type: 'ready' });
  expect(parameters).toHaveLength(count);
  expect(host.Component.add).toHaveBeenCalledTimes(9);
  expect(document.querySelectorAll('.shikimori-local-menu-item')).toHaveLength(1);
  expect(listeners.app.size).toBe(0);
});

test('bootstrap discovers a late host without an extra ready event', () => {
  delete window.Lampa; delete global.Lampa; window.appready = true;
  require('../src/index');
  expect(host.Component.add).not.toHaveBeenCalled();
  global.Lampa = window.Lampa = host;
  jest.advanceTimersByTime(500);
  expect(window.__shikimori_local_ready).toBe(true);
  expect(host.Component.add).toHaveBeenCalledTimes(9);
  expect(jest.getTimerCount()).toBe(0);
});

test('bootstrap polling stops when the host never appears', () => {
  delete window.Lampa; delete global.Lampa;
  require('../src/index'); jest.advanceTimersByTime(60000);
  expect(jest.getTimerCount()).toBe(0);
  expect(window.__shikimori_local_ready).not.toBe(true);
  expect(host.Component.add).not.toHaveBeenCalled();
});

test('a failed immediate initialization retries and registers components only once', () => {
  window.appready = true;
  host.SettingsApi.addComponent.mockImplementationOnce(() => { throw new Error('temporary settings failure'); });
  expect(() => require('../src/index')).not.toThrow();
  expect(window.__shikimori_local_ready).not.toBe(true);
  jest.advanceTimersByTime(500);
  expect(window.__shikimori_local_ready).toBe(true);
  expect(host.Component.add).toHaveBeenCalledTimes(9);
  expect(jest.getTimerCount()).toBe(0);
});

test('a failed ready-event initialization retries without waiting for another event', () => {
  require('../src/index');
  let failed = false;
  host.Component.add.mockImplementation((name, Component) => {
    if (name === 'shikimori_local_line' && !failed) {
      failed = true;
      throw new Error('temporary component failure');
    }
    components[name] = Component;
  });
  window.appready = true;
  expect(() => emit('app', { type: 'ready' })).not.toThrow();
  expect(window.__shikimori_local_ready).not.toBe(true);
  jest.advanceTimersByTime(500);
  expect(window.__shikimori_local_ready).toBe(true);
  expect(Object.keys(components)).toHaveLength(9);
  expect(host.Component.add.mock.calls.filter(call => call[0] === 'shikimori_local_home')).toHaveLength(1);
  expect(host.Component.add.mock.calls.filter(call => call[0] === 'shikimori_local_anime')).toHaveLength(1);
  expect(listeners.app.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
});

test('settings toggles remove and restore one menu item with one activation', () => {
  settings.register(); menu.register(); menu.register();
  change('showMenu', 'false');
  expect(document.querySelector('.shikimori-local-menu-item')).toBeNull();
  change('showMenu', 'true'); change('enabled', 'false');
  menu.openHome();
  expect(document.querySelector('.shikimori-local-menu-item')).toBeNull();
  expect(host.Activity.push).not.toHaveBeenCalled();
  change('enabled', 'true'); menu.register();
  expect(document.querySelectorAll('.shikimori-local-menu-item')).toHaveLength(1);
  document.querySelector('.shikimori-local-menu-item').click();
  expect(host.Activity.push).toHaveBeenCalledTimes(1);
});

test('a fresh menu registration gets a bounded retry after an earlier timeout', () => {
  document.querySelector('.menu__list').remove();
  menu.register(); jest.advanceTimersByTime(10000);
  expect(jest.getTimerCount()).toBe(0);
  menu.register();
  const list = document.createElement('div'); list.className = 'menu__list'; document.body.appendChild(list);
  jest.advanceTimersByTime(500);
  expect(list.querySelectorAll('.shikimori-local-menu-item')).toHaveLength(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('cancelled settings prompts do not write, warn or start authentication', () => {
  const auth = require('../src/auth');
  const exchange = jest.spyOn(auth, 'exchangeCode');
  settings.register(); host.Storage.set.mockClear(); host.Noty.show.mockClear();
  for (const name of ['pageSize', 'uiRadius', 'apiBaseUrl', 'oauthCode', 'authToken']) {
    action(name).onChange();
    const submit = host.Input.edit.mock.calls.at(-1)[1];
    submit(null); submit(undefined);
  }
  expect(host.Storage.set).not.toHaveBeenCalled();
  expect(host.Noty.show).not.toHaveBeenCalled();
  expect(exchange).not.toHaveBeenCalled();
  host.Input = null; global.prompt = jest.fn(() => null);
  action('authToken').onChange();
  expect(host.Noty.show).not.toHaveBeenCalled();
});

test('zero radius remains zero in the prompt and persisted UI settings', () => {
  store[config.STORAGE_KEYS.ui] = { radius: 0 };
  settings.register(); action('uiRadius').onChange();
  const [options, submit] = host.Input.edit.mock.calls[0];
  expect(options.value).toBe('0');
  submit('0');
  expect(store[config.STORAGE_KEYS.ui].radius).toBe(0);
  expect(styles.applyUiSettings).toHaveBeenLastCalledWith({ radius: 0 });
});

test('debug flag accepts boolean/string/number triggers without truthy false strings', () => {
  settings.register();
  for (const value of [true, 'true', 1, '1']) { change('debug', value); expect(logger.isDebug()).toBe(true); }
  for (const value of [false, 'false', 0, '0']) { change('debug', value); expect(logger.isDebug()).toBe(false); }
});
