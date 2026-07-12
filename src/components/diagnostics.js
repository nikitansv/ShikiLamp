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

function Diagnostics() {
  this.html = null;
  this.logEntries = [];
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
    hasToken: !!settings.getExperimentalToken()
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
  } else if (action === 'clear-log') {
    this.logEntries = [];
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

Diagnostics.prototype.log = function (text) {
  this.logEntries.push(text);
};

Diagnostics.prototype.buildReport = function () {
  const data = this.collectData();
  return JSON.stringify({
    plugin_id: config.PLUGIN_ID,
    version: data.version,
    lampa_version: data.lampaVersion,
    has_maker: data.hasMaker,
    has_content_rows: data.hasContentRows,
    api_base_url: data.apiBaseUrl,
    cache_size: data.cacheSize,
    mapping_count: data.mappingCount,
    log: this.logEntries,
    token_present: data.hasToken,
    exported_at: Date.now ? Date.now() : new Date().getTime()
  }, null, 2);
};

Diagnostics.prototype.render = function () {
  return this.html;
};

Diagnostics.prototype.destroy = function () {
  this.html = null;
};

module.exports = Diagnostics;
