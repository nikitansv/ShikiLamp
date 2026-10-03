/**
 * Mappings list component.
 */
const templates = require('../ui/templates');
const storage = require('../mapping/storage');
const lifecycle = require('./lifecycle');

function Mappings() {
  this.html = null;
}

Mappings.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.renderBody();
};

Mappings.prototype.renderBody = function () {
  lifecycle.rememberFocus(this);
  const self = this;
  const list = storage.list();
  this.html.innerHTML = '<div class="shikimori-local mappings-page">' +
    '<div class="shikimori-local__head">Локальные соответствия (' + list.length + ')</div>' +
    '<div class="shikimori-local__results"></div>' +
  '</div>';
  const results = this.html.querySelector('.shikimori-local__results');
  if (list.length === 0) {
    results.innerHTML = '<div class="shikimori-local__empty">Соответствий пока нет</div>';
    lifecycle.refocus(this);
    return;
  }
  list.forEach(function (m) {
    const el = document.createElement('div');
    el.className = 'shikimori-local__mapping';
    el.innerHTML = '<div class="shikimori-local__mapping-title">Shikimori ID ' + templates.escapeHtml(m.shikimori_id) + '</div>' +
      '<div class="shikimori-local__mapping-meta">TMDB ' + templates.escapeHtml(m.tmdb_type) + ' ' + templates.escapeHtml(m.tmdb_id) + ' · season ' + templates.escapeHtml(m.tmdb_season) + ' · offset ' + templates.escapeHtml(m.episode_offset) + ' · ' + (m.verified ? 'verified' : 'auto') + '</div>' +
      '<div class="shikimori-local__action selector" data-id="' + templates.escapeHtml(m.shikimori_id) + '">Удалить</div>';
    lifecycle.bindAction(el.querySelector('[data-id]'), function () {
      storage.remove(m.shikimori_id);
      self.renderBody();
    });
    results.appendChild(el);
  });
  lifecycle.refocus(this);
};

Mappings.prototype.render = function () {
  return this.html;
};

Mappings.prototype.destroy = function () {
  this.html = null;
};

module.exports = Mappings;
