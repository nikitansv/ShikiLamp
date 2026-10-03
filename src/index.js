/**
 * Plugin entry point.
 */
const config = require('./config');
const logger = require('./logger');
const settings = require('./settings');
const menu = require('./ui/menu');
const styles = require('./ui/styles');

const Home = require('./components/home');
const Anime = require('./components/anime');
const Line = require('./components/line');
const UserLists = require('./components/userlists');
const Filter = require('./components/filter');
const Mapping = require('./components/mapping');
const Mappings = require('./components/mappings');
const Diagnostics = require('./components/diagnostics');
const Search = require('./components/search');
const lifecycle = require('./components/lifecycle');

const READY_FLAG = '__shikimori_local_ready';

function init() {
  const Lampa = typeof window !== 'undefined' ? window.Lampa : null;
  if (!Lampa || !window.appready) return;

  if (window[READY_FLAG]) {
    logger.log('Already initialized');
    return;
  }
  logger.log('Initializing', config.PLUGIN_ID, config.VERSION);

  logger.setDebug(settings.isDebug());
  styles.injectStyles();
  settings.register();
  registerComponents();
  menu.register();
  window[READY_FLAG] = true;
}

function registerComponents() {
  const Lampa = window.Lampa;
  const components = {
    shikimori_local_home: lifecycle.attachLifecycle(Home),
    shikimori_local_anime: lifecycle.attachLifecycle(Anime),
    shikimori_local_line: lifecycle.attachLifecycle(Line),
    shikimori_local_userlists: lifecycle.attachLifecycle(UserLists),
    shikimori_local_filter: lifecycle.attachLifecycle(Filter),
    shikimori_local_mapping: lifecycle.attachLifecycle(Mapping),
    shikimori_local_mappings: lifecycle.attachLifecycle(Mappings),
    shikimori_local_diagnostics: lifecycle.attachLifecycle(Diagnostics),
    shikimori_local_search: lifecycle.attachLifecycle(Search)
  };

  Object.keys(components).forEach(function (name) {
    if (Lampa.Component && Lampa.Component.add) {
      if (!Lampa.Component.get || !Lampa.Component.get(name)) {
        Lampa.Component.add(name, components[name]);
      }
    }
  });
}

if (typeof window !== 'undefined' && !window.__shikimori_local_cjs_loaded) {
  window.__shikimori_local_cjs_loaded = true;
  let attempts = 0;
  let retryTimer = null;
  let readyListener = null;
  function onReady(event) {
    if (event && event.type === 'ready') waitForLampa();
  }
  function waitForLampa() {
    clearTimeout(retryTimer);
    retryTimer = null;
    if (window.appready && window.Lampa) {
      try {
        init();
        if (readyListener && readyListener.remove) readyListener.remove('app', onReady);
        return;
      } catch (err) { logger.warn('Initialization failed', err.message); }
    }
    const listener = window.Lampa && window.Lampa.Listener;
    if (!window.appready && listener && listener.follow) {
      if (!readyListener) {
        readyListener = listener;
        listener.follow('app', onReady);
      }
    } else if (++attempts < 120) {
      retryTimer = setTimeout(waitForLampa, 500);
    }
  }
  waitForLampa();
}

module.exports = { init, PLUGIN_ID: config.PLUGIN_ID, VERSION: config.VERSION };
