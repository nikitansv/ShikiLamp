/**
 * Diagnostics component.
 */
const config = require('../config');
const templates = require('../ui/templates');
const logger = require('../logger');
const cache = require('../cache');
const mappingStorage = require('../mapping/storage');
const settings = require('../settings');
const api = require('../api');
const auth = require('../auth');
const userApi = require('../api/user');

function Diagnostics() {
  this.html = null;
  this.logEntries = [];
  this.listCheck = null;
}

Diagnostics.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.renderBody();
};

Diagnostics.prototype.renderBody = function () {
  const self = this;
  const data = this.collectData();
  this.html.innerHTML = templates.diagnosticsTemplate(data);
  this.html.querySelectorAll('.shikimori-local__action').forEach(function (el) {
    el.addEventListener('hover:enter', function () {
      self.handleAction(el.getAttribute('data-action'));
    });
    el.addEventListener('click', function () {
      self.handleAction(el.getAttribute('data-action'));
    });
  });
  if (typeof Lampa !== 'undefined' && Lampa.Controller) {
    Lampa.Controller.collectionSet(this.html);
    const first = this.html.querySelector('.shikimori-local__action');
    if (first) Lampa.Controller.collectionFocus(first, this.html);
  }
};

Diagnostics.prototype.collectData = function () {
  const hasMaker = !!(typeof Lampa !== 'undefined' && Lampa.Maker && Lampa.Maker.make);
  const hasContentRows = !!(typeof Lampa !== 'undefined' && Lampa.ContentRows && Lampa.ContentRows.add);
  const user = auth.getCachedUser();
  return {
    version: config.VERSION,
    lampaVersion: (typeof Lampa !== 'undefined' && Lampa.Manifest && Lampa.Manifest.app_version) ? Lampa.Manifest.app_version : '?',
    hasMaker: hasMaker,
    hasContentRows: hasContentRows,
    apiBaseUrl: settings.getApiBaseUrl(),
    lastRequestStatus: this.logEntries.length > 0 ? this.logEntries[this.logEntries.length - 1] : '-',
    cacheSize: cache.size(),
    mappingCount: mappingStorage.count(),
    corsTest: 'pending',
    hasToken: !!settings.getExperimentalToken(),
    authUser: user ? (user.nickname || user.name || 'ID ' + user.id) + ' (ID ' + user.id + ')' : 'не проверен'
  };
};

Diagnostics.prototype.handleAction = function (action) {
  const self = this;
  if (action === 'test-api') {
    api.testConnection().then(function () {
      self.log('API OK');
      self.renderBody();
    }).catch(function (err) {
      self.log('API FAIL: ' + err.message);
      self.renderBody();
    });
  } else if (action === 'test-graphql') {
    api.testConnection().then(function (data) {
      self.log('GraphQL OK: ' + (data && data.data && data.data.__schema ? 'schema available' : 'unknown'));
      self.renderBody();
    }).catch(function (err) {
      self.log('GraphQL FAIL: ' + err.message);
      self.renderBody();
    });
  } else if (action === 'test-search') {
    api.search('Frieren').then(function (list) {
      self.log('Search OK: ' + list.length + ' results');
      self.renderBody();
    }).catch(function (err) {
      self.log('Search FAIL: ' + err.message);
      self.renderBody();
    });
  } else if (action === 'check-user-lists') {
    this.checkUserLists();
  } else if (action === 'clear-log') {
    this.logEntries = [];
    if (logger.clear) logger.clear();
    this.renderBody();
  } else if (action === 'export-report') {
    const report = this.buildReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shikimori-local-diagnostics.json';
    a.click();
    URL.revokeObjectURL(url);
  }
};

Diagnostics.prototype.checkUserLists = function () {
  const self = this;
  const user = auth.getCachedUser();
  if (!auth.getToken() || !user || !user.id) {
    this.log('Мои списки: нужна проверенная авторизация Shikimori');
    this.renderBody();
    return;
  }

  this.log('Мои списки: загружаю полный список...');
  this.renderBody();
  Promise.all([
    userApi.listAllAnimeRates(user.id, 'planned'),
    userApi.listAllAnimeRates(user.id, 'watching')
  ]).then(function (lists) {
    self.listCheck = {
      user: { id: user.id, nickname: user.nickname || user.name || '' },
      planned: summarizeList(lists[0]),
      watching: summarizeList(lists[1])
    };
    self.log('В планах: ' + self.listCheck.planned.total + ', выходит: ' + self.listCheck.planned.ongoing.length);
    self.log('Смотрю: ' + self.listCheck.watching.total + ', выходит: ' + self.listCheck.watching.ongoing.length);
    self.renderBody();
  }).catch(function (err) {
    self.log('Мои списки FAIL: ' + err.message);
    self.renderBody();
  });
};

function summarizeList(list) {
  const ongoing = (list || []).filter(userApi.isCurrentlyAiring).map(function (anime) {
    return {
      id: anime.shikimori_id,
      title: anime.title,
      status: anime.status,
      episodes: anime.episodes,
      episodes_aired: anime.episodes_aired,
      release_date: anime.release_date
    };
  });
  return { total: (list || []).length, ongoing: ongoing };
}

Diagnostics.prototype.log = function (text) {
  this.logEntries.push(text);
};

Diagnostics.prototype.buildReport = function () {
  const data = this.collectData();
  const runtimeLogs = logger.getEntries ? logger.getEntries() : [];
  return JSON.stringify({
    plugin_id: config.PLUGIN_ID,
    version: data.version,
    lampa_version: data.lampaVersion,
    environment: {
      href: sanitizeUrl(typeof location !== 'undefined' ? location.href : ''),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      platform: typeof navigator !== 'undefined' ? navigator.platform : '',
      appready: typeof window !== 'undefined' ? !!window.appready : false
    },
    capabilities: {
      has_maker: data.hasMaker,
      has_content_rows: data.hasContentRows,
      has_storage: !!(typeof Lampa !== 'undefined' && Lampa.Storage),
      has_network: !!(typeof Lampa !== 'undefined' && Lampa.Network),
      has_fetch: typeof fetch === 'function'
    },
    api_base_url: data.apiBaseUrl,
    cache_size: data.cacheSize,
    mapping_count: data.mappingCount,
    auth_user: this.listCheck ? this.listCheck.user : null,
    user_lists: this.listCheck,
    diagnostics_log: this.logEntries.slice(),
    runtime_log: runtimeLogs,
    token_present: data.hasToken,
    token_value: '[REDACTED]',
    exported_at: Date.now ? Date.now() : new Date().getTime()
  }, null, 2);
};

function sanitizeUrl(url) {
  return String(url || '')
    .replace(/([?&](?:token|access_token|refresh_token|code|client_secret|email)=)[^&]+/gi, '$1[REDACTED]')
    .slice(0, 500);
}

Diagnostics.prototype.render = function () {
  return this.html;
};

Diagnostics.prototype.destroy = function () {
  this.html = null;
};

module.exports = Diagnostics;
