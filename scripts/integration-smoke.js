const { JSDOM } = require('jsdom');

// Browser globals
const dom = new JSDOM('<!DOCTYPE html><html><body><div class="menu__list"></div><div id="log"></div></body></html>', {
  url: 'http://127.0.0.1:8080/test.html',
  pretendToBeVisual: true,
  resources: 'usable'
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Lampa mock
window.appready = true;
let activityLog = [];
let components = {};
let notyLog = [];
let storage = {};

window.Lampa = {
  Listener: { follow: function(type, cb) { if (type === 'app') setTimeout(() => cb({ type: 'ready' }), 0); }, send: function() {} },
  Storage: {
    get: (k, def) => (storage.hasOwnProperty(k) ? storage[k] : def),
    set: (k, v) => { storage[k] = v; }
  },
  Component: {
    add: (name, C) => { components[name] = C; },
    get: (name) => components[name]
  },
  Activity: { push: (obj) => { activityLog.push(obj); } },
  Router: { call: (route, card) => { console.log('Router.call', route, JSON.stringify(card).slice(0, 120)); } },
  Noty: { show: (m) => { notyLog.push(m); } },
  Api: {
    search: (params, onSuccess) => {
      setTimeout(() => onSuccess({ movie: { results: [] }, tv: { results: [] } }), 10);
    }
  },
  Controller: { collectionSet: () => {}, collectionFocus: () => {} },
  SettingsApi: {
    addComponent: () => {},
    addParam: (obj) => {
      if (obj.param && obj.param.type === 'button' && obj.onChange) {
        // no-op, just verify registration
      }
    }
  },
  Network: null,
  Reguest: null
};
global.Lampa = window.Lampa;

// Load plugin as script
delete require.cache[require.resolve('../dist/plugin.js')];
require('../dist/plugin.js');

setTimeout(() => {
  console.log('--- Plugin init check ---');
  console.log('window.__shikimori_local_ready:', !!window.__shikimori_local_ready);
  console.log('Menu item exists:', !!document.querySelector('.shikimori-local-menu-item'));
  console.log('Components registered:', Object.keys(components).sort().join(', '));

  // Simulate menu click
  const menuItem = document.querySelector('.shikimori-local-menu-item');
  if (menuItem) {
    const ev = new dom.window.Event('click');
    menuItem.dispatchEvent(ev);
    console.log('Activities after click:', activityLog.length);
    console.log('Activity:', JSON.stringify(activityLog[0]));
  }

  // Instantiate home component
  const Home = components.shikimori_local_home;
  if (Home) {
    const inst = new Home();
    inst.create();
    console.log('Home rendered:', !!inst.html);
  }

  // Test API adapter directly
  const api = require('../src/api');
  if (!api || !api.search) {
    console.error('API adapter missing search function');
    console.log('--- final storage keys ---');
    console.log(Object.keys(storage).filter(k => k.startsWith('shikimori_local')).join(', '));
    dom.window.close();
    process.exit(0);
    return;
  }
  api.search({ query: 'Frieren', limit: 2 })
    .then(list => {
      console.log('API search returned', list.length, 'items');
      if (list.length > 0) {
        console.log('First title:', list[0].title, 'Shikimori ID:', list[0].shikimori_id);
      }
    })
    .catch(err => {
      console.error('API search failed:', err.message);
    })
    .finally(() => {
      console.log('--- final storage keys ---');
      console.log(Object.keys(storage).filter(k => k.startsWith('shikimori_local')).join(', '));
      dom.window.close();
      process.exit(0);
    });
}, 500);

setTimeout(() => {
  console.log('--- timeout fallback ---');
  process.exit(0);
}, 30000);
