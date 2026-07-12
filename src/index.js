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
const Search = require('./components/search');
const Anime = require('./components/anime');
const Line = require('./components/line');
const Mapping = require('./components/mapping');
const Mappings = require('./components/mappings');
const Diagnostics = require('./components/diagnostics');

const READY_FLAG = '__shikimori_local_ready';

function init() {
  if (!window.Lampa) {
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
  const components = {
    shikimori_local_home: Home,
    shikimori_local_search: Search,
    shikimori_local_anime: Anime,
    shikimori_local_line: Line,
    shikimori_local_mapping: Mapping,
    shikimori_local_mappings: Mappings,
    shikimori_local_diagnostics: Diagnostics
  };

  Object.keys(components).forEach(function (name) {
    if (Lampa.Component && Lampa.Component.add) {
      if (!Lampa.Component.get(name)) {
        Lampa.Component.add(name, components[name]);
      }
    }
  });
}

if (typeof window !== 'undefined') {
  if (window.appready) {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', function () {
      if (window.appready) init();
    });
    if (window.Lampa && window.Lampa.Listener) {
      window.Lampa.Listener.follow('app', function (event) {
        if (event && event.type === 'ready') init();
      });
    }
  }
}

module.exports = { init, PLUGIN_ID: config.PLUGIN_ID, VERSION: config.VERSION };
