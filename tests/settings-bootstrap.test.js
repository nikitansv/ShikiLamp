const { JSDOM } = require('jsdom');

let dom, host, store, listeners, components, parameters, config, settings, menu, logger, styles;
function emit(type, event) { Array.from(listeners[type] || []).forEach(callback => callback(event)); }
function action(name) { return parameters.find(item => item.param.name === 'shikimori_local_action_' + name); }
function change(key, value) {
  const name = config.STORAGE_KEYS[key];
  host.Storage.set(name, value);
  // Real SettingsApi passes the scalar value, not a Storage change event.
  parameters.find(item => item.param.name === name).onChange(value);
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
    Activity: { push: jest.fn() }, Noty: { show: jest.fn() }, Input: { edit: jest.fn() },
    Controller: { enabled: () => ({ name: 'settings_component' }), toggle: jest.fn() },
    Select: { show: jest.fn(), close: jest.fn() }
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
  change('enabled', 'false');
  expect(document.querySelector('.shikimori-local-menu-item')).toBeNull();
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
  for (const index of [1, 2]) {
    action('account').onChange();
    const dialog = host.Select.show.mock.calls.at(-1)[0];
    dialog.onSelect(dialog.items[index]);
    const submit = host.Input.edit.mock.calls.at(-1)[1];
    submit(null); submit(undefined);
  }
  expect(host.Storage.set).not.toHaveBeenCalled();
  expect(host.Noty.show).not.toHaveBeenCalled();
  expect(exchange).not.toHaveBeenCalled();
  host.Input = null; global.prompt = jest.fn(() => null);
  action('account').onChange();
  const dialog = host.Select.show.mock.calls.at(-1)[0];
  dialog.onSelect(dialog.items[2]);
  expect(host.Noty.show).not.toHaveBeenCalled();
});

test('appearance reset preserves motion, authentication and mappings', () => {
  store[config.STORAGE_KEYS.ui] = { radius: 0, focusColor: 'red', motion: 'soft' };
  store[config.STORAGE_KEYS.motion] = 'off';
  store[config.STORAGE_KEYS.experimentalToken] = 'saved-session';
  store[config.STORAGE_KEYS.mappings] = 'saved-mappings';
  settings.register(); action('resetAppearance').onChange();
  expect(settings.getUi()).toEqual({ motion: 'off' });
  expect(styles.applyUiSettings).toHaveBeenLastCalledWith({ motion: 'off' });
  expect(store[config.STORAGE_KEYS.experimentalToken]).toBe('saved-session');
  expect(store[config.STORAGE_KEYS.mappings]).toBe('saved-mappings');
});

test('legacy debug flag still reads booleans without exposing a developer menu', () => {
  settings.register();
  for (const value of [true, 'true', 1, '1']) { store[config.STORAGE_KEYS.debug] = value; expect(settings.isDebug()).toBe(true); }
  for (const value of [false, 'false', 0, '0']) { store[config.STORAGE_KEYS.debug] = value; expect(settings.isDebug()).toBe(false); }
});

test('appearance reset retains a legacy motion selection before its first native change', () => {
  store[config.STORAGE_KEYS.ui] = { motion: 'soft', radius: 24 };
  settings.register(); action('resetAppearance').onChange();
  expect(settings.getUi()).toEqual({ motion: 'soft' });
  expect(store[config.STORAGE_KEYS.motion]).toBe('soft');
});

test('one settings section keeps native choices and migrates old menu visibility', () => {
  store[config.STORAGE_KEYS.showMenu] = false;
  store[config.STORAGE_KEYS.pageSize] = 7;
  store[config.STORAGE_KEYS.ui] = { motion: 'soft' };
  settings.register();
  expect(host.SettingsApi.addComponent).toHaveBeenCalledTimes(1);
  expect(host.SettingsApi.addComponent.mock.calls[0][0].name).toBe('ShikiLamp');
  expect(parameters.every(param => param.component === 'shikilamp_local_settings')).toBe(true);
  expect(parameters.filter(param => param.param.type === 'title').map(param => param.field.name)).toEqual(['Аккаунт', 'Каталог и интерфейс', 'Данные и помощь']);
  expect(settings.isEnabled()).toBe(false);
  expect(settings.showMenu()).toBe(true);
  expect(parameters.find(param => param.param.name === config.STORAGE_KEYS.pageSize).param.values['7']).toBe('7');
  expect(parameters.find(param => param.param.name === config.STORAGE_KEYS.motion).param.default).toBe('soft');
  change('motion', 'off');
  expect(styles.applyUiSettings).toHaveBeenLastCalledWith({ motion: 'off' });
});

test('account menu restores settings focus on cancel and updates status on logout', () => {
  store[config.STORAGE_KEYS.experimentalToken] = 'test-session';
  store[config.STORAGE_KEYS.authUser] = { id: 1, nickname: 'Tester' };
  const label = { text: jest.fn() };
  settings.register();
  action('account').onRender({ find: () => label });
  expect(label.text).toHaveBeenLastCalledWith('Выполнен вход: Tester');
  action('account').onChange();
  let dialog = host.Select.show.mock.calls.at(-1)[0];
  dialog.onBack();
  expect(host.Select.close).not.toHaveBeenCalled();
  expect(host.Controller.toggle).toHaveBeenLastCalledWith('settings_component');
  action('account').onChange();
  dialog = host.Select.show.mock.calls.at(-1)[0];
  dialog.onSelect(dialog.items.find(item => item.title === 'Выйти из аккаунта'));
  expect(store[config.STORAGE_KEYS.experimentalToken]).toBe('');
  expect(label.text).toHaveBeenLastCalledWith('Не авторизован');
});

test('native appearance defaults remove previously applied custom colors', () => {
  const realStyles = jest.requireActual('../src/ui/styles');
  realStyles.applyUiSettings({ focusColor: 'red' });
  expect(document.documentElement.style.getPropertyValue('--shiki-focus-color')).toBe('red');
  realStyles.applyUiSettings({});
  expect(document.documentElement.style.getPropertyValue('--shiki-focus-color')).toBe('');
});
