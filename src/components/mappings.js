/**
 * Mappings list component.
 */
const templates = require('../ui/templates');
const storage = require('../mapping/storage');

function Mappings() {
  this.html = null;
}

Mappings.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.render();
};

Mappings.prototype.render = function () {
  const self = this;
  const list = storage.list();
  this.html.innerHTML = '<div class="shikimori-local mappings-page">' +
    '<div class="shikimori-local__head">Локальные соответствия (' + list.length + ')</div>' +
    '<div class="shikimori-local__results"></div>' +
  '</div>';
  const results = this.html.querySelector('.shikimori-local__results');
  if (list.length === 0) {
    results.innerHTML = '<div class="shikimori-local__empty">Соответствий пока нет</div>';
    return;
  }
  list.forEach(function (m) {
    const el = document.createElement('div');
    el.className = 'shikimori-local__mapping selector';
    el.innerHTML = '<div class="shikimori-local__mapping-title">Shikimori ID ' + m.shikimori_id + '</div>' +
      '<div class="shikimori-local__mapping-meta">TMDB ' + m.tmdb_type + ' ' + m.tmdb_id + ' · season ' + m.tmdb_season + ' · offset ' + m.episode_offset + ' · ' + (m.verified ? 'verified' : 'auto') + '</div>' +
      '<div class="shikimori-local__action selector" data-id="' + m.shikimori_id + '">Удалить</div>';
    el.querySelector('[data-id]').addEventListener('hover:enter', function () {
      storage.remove(m.shikimori_id);
      self.render();
    });
    results.appendChild(el);
  });
  if (typeof Lampa !== 'undefined' && Lampa.Controller) {
    Lampa.Controller.collectionSet(this.html);
    const first = this.html.querySelector('.shikimori-local__mapping');
    if (first) Lampa.Controller.collectionFocus(first, this.html);
  }
};

Mappings.prototype.renderComponent = function () {
  return this.html;
};

Mappings.prototype.destroy = function () {
  this.html = null;
};

module.exports = Mappings;
