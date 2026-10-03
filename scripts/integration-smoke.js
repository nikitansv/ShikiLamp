// Exercise the distributed bundle, without credentials, a server or live APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const bundle = fs.readFileSync(path.join(root, 'dist/plugin.js'), 'utf8');
assert.equal(bundle, fs.readFileSync(path.join(root, 'docs/ShikiLamp.js'), 'utf8'), 'Published and local bundles must match');
const script = new vm.Script(bundle, { filename: 'plugin.js' });
const expected = ['home', 'anime', 'line', 'userlists', 'filter', 'mapping', 'mappings', 'diagnostics', 'search']
  .map(name => 'shikimori_local_' + name).sort();

async function startup(mode) {
  const dom = new JSDOM('<!doctype html><div class="menu__list"></div><main></main>', {
    url: 'https://shikilamp.test/', runScripts: 'outside-only', pretendToBeVisual: true
  });
  try {
    const win = dom.window;
    const listeners = {};
    const components = {};
    const store = {};
    const activities = [];
    const parameters = [];
    const host = {
      Listener: {
        follow(type, callback) { (listeners[type] || (listeners[type] = [])).push(callback); },
        remove(type, callback) { listeners[type] = (listeners[type] || []).filter(item => item !== callback); }
      },
      Storage: { get: (key, fallback) => Object.hasOwn(store, key) ? store[key] : fallback, set: (key, value) => { store[key] = value; } },
      Component: { add: (name, component) => { components[name] = component; }, get: name => components[name] },
      SettingsApi: { addComponent() {}, addParam: param => parameters.push(param) },
      Activity: { push: data => activities.push(data) },
      Controller: { add() {}, collectionSet() {}, collectionFocus() {} },
      Noty: { show() {} },
      Api: { search: (params, done) => done({ tv: { results: [] }, movie: { results: [] } }) },
      Network: { quiet: (url, done) => done([]) }
    };
    if (mode !== 'late-host') win.Lampa = host;
    win.appready = mode === 'ready';
    script.runInContext(dom.getInternalVMContext());
    if (mode !== 'ready') {
      assert.equal(Object.keys(components).length, 0, 'Must wait for appready');
      if (mode === 'late-host') {
        win.Lampa = host;
        await new Promise(resolve => setTimeout(resolve, 550));
      }
      win.appready = true;
      (listeners.app || []).slice().forEach(callback => callback({ type: 'ready' }));
    }
    assert.equal(win.__shikimori_local_ready, true, mode + ': plugin initialized');
    assert.deepEqual(Object.keys(components).sort(), expected, 'All screens registered');
    const parameterCount = parameters.length;
    assert.ok(parameterCount > 10, 'Settings registered');
    script.runInContext(dom.getInternalVMContext());
    win.ShikimoriLocalPlugin.init();
    assert.equal(parameters.length, parameterCount, 'Repeated bundle does not duplicate settings');
    assert.equal(win.document.querySelectorAll('.shikimori-local-menu-item').length, 1, 'Exactly one menu entry');
    win.document.querySelector('.shikimori-local-menu-item').click();
    assert.equal(activities.length, 1, 'Menu activation opens exactly one screen');
    assert.equal(activities[0].component, 'shikimori_local_home');
    const home = new components.shikimori_local_home();
    home.create();
    win.document.querySelector('main').appendChild(home.render());
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(home.html.querySelector('[data-row="ongoing"]'), 'Home has the ongoing rail');
    home.destroy();
    console.log('Bundle smoke OK: ' + mode);
  } finally { dom.window.close(); }
}

(async () => {
  for (const mode of ['ready', 'before-ready', 'late-host']) await startup(mode);
})().catch(error => { console.error(error); process.exitCode = 1; });
