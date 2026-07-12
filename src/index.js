/**
 * Plugin entry point.
 */
const config = require('./config');
const logger = require('./logger');
const settings = require('./settings');
const menu = require('./ui/menu');
const cache = require('./cache');
const api = require('./api');
const styles = require('./ui/styles');

const Home = require('./components/home');
const Anime = require('./components/anime');
const Line = require('./components/line');
const Mapping = require('./components/mapping');
const Mappings = require('./components/mappings');
const Diagnostics = require('./components/diagnostics');
const lifecycle = require('./components/lifecycle');

const READY_FLAG = '__shikimori_local_ready';

function init() {
  const Lampa = typeof window !== 'undefined' ? window.Lampa : null;
  if (!Lampa) {
    logger.warn('Lampa not available');
    return;
  }

  if (window[READY_FLAG]) {
    logger.log('Already initialized');
    return;
  }
  window[READY_FLAG] = true;

  logger.log('Initializing', config.PLUGIN_ID, config.VERSION);

  logger.setDebug(settings.isDebug());
  styles.injectStyles();
  settings.register();
  menu.register();
  registerComponents();

  Lampa.Listener.follow('app', function (event) {
    if (event && event.type === 'ready') {
      menu.register();
    }
  });
}

function registerComponents() {
  const Lampa = window.Lampa;
  const components = {
    shikimori_local_home: lifecycle.attachLifecycle(Home),
    shikimori_local_anime: lifecycle.attachLifecycle(Anime),
    shikimori_local_line: lifecycle.attachLifecycle(Line),
    shikimori_local_mapping: lifecycle.attachLifecycle(Mapping),
    shikimori_local_mappings: lifecycle.attachLifecycle(Mappings),
    shikimori_local_diagnostics: lifecycle.attachLifecycle(Diagnostics)
  };

  Object.keys(components).forEach(function (name) {
    if (Lampa.Component && Lampa.Component.add) {
      if (!Lampa.Component.get(name)) {
        Lampa.Component.add(name, components[name]);
      }
    }
  });
}

if (typeof window !== 'undefined' && !window.__shikimori_local_cjs_loaded) {
  window.__shikimori_local_cjs_loaded = true;
  // Browser-only auto-init is handled by build footer to ensure Lampa is ready.
  // Keep DOMContentLoaded fallback for direct script usage without footer.
  if (!window.__shikimori_local_footer_init) {
    window.addEventListener('DOMContentLoaded', function () {
      if (window.appready && window.Lampa) init();
    });
    if (window.Lampa && window.Lampa.Listener) {
      window.Lampa.Listener.follow('app', function (event) {
        if (event && event.type === 'ready') init();
      });
    }
  }
}

module.exports = { init, PLUGIN_ID: config.PLUGIN_ID, VERSION: config.VERSION };
