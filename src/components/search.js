/**
 * Search component for Shikimori anime.
 */
const api = require('../api');
const templates = require('../ui/templates');
const logger = require('../logger');
const matcher = require('../mapping/matcher');

function Search(params) {
  this.params = params || {};
  this.html = null;
  this.results = null;
  this.currentQuery = this.params.query || '';
  this.page = 1;
  this.loading = false;
  this.ended = false;
}

Search.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = '<div class="shikimori-local search-page">' +
    '<div class="shikimori-local__head">Поиск по Shikimori</div>' +
    '<div class="shikimori-local__action selector" data-action="search">Ввести запрос</div>' +
    '<div class="shikimori-local__query"></div>' +
    '<div class="shikimori-local__results"></div>' +
  '</div>';
  this.results = this.html.querySelector('.shikimori-local__results');
  this.bindEvents();
  if (this.currentQuery) this.doSearch(this.currentQuery, false);
};

Search.prototype.bindEvents = function () {
  const self = this;
  const btn = this.html.querySelector('[data-action="search"]');
  btn.addEventListener('hover:enter', function () { self.askSearch(); });
  btn.addEventListener('click', function () { self.askSearch(); });
};

Search.prototype.askSearch = function () {
  const self = this;
  if (typeof Lampa !== 'undefined' && Lampa.Input && Lampa.Input.edit) {
    Lampa.Input.edit({ title: 'Поиск Shikimori', value: this.currentQuery || '', free: true }, function (text) {
      const query = String(text || '').trim();
      if (query) self.doSearch(query, false);
      else if (Lampa.Noty) Lampa.Noty.show('Введите название аниме');
    });
    return;
  }
  const query = String(prompt('Поиск Shikimori', this.currentQuery || '') || '').trim();
  if (query) this.doSearch(query, false);
};

Search.prototype.doSearch = function (query, append) {
  const self = this;
  const q = String(query || '').trim();
  if (!q || this.loading) return;
  if (!append) {
    this.page = 1;
    this.ended = false;
    this.results.innerHTML = '';
  }
  if (append && this.ended) return;
  this.currentQuery = q;
  this.loading = true;
  this.removeMoreButton();
  this.updateQueryLabel();
  this.results.insertAdjacentHTML('beforeend', '<div class="shikimori-local__loading">Загрузка...</div>');
  api.search(q, this.page).then(function (list) {
    self.loading = false;
    self.html.querySelectorAll('.shikimori-local__loading').forEach(function (el) { el.remove(); });
    self.renderResults(list || [], append);
  }).catch(function (err) {
    self.loading = false;
    logger.warn('Search error', err.message);
    self.html.querySelectorAll('.shikimori-local__loading').forEach(function (el) { el.remove(); });
    self.results.insertAdjacentHTML('beforeend', '<div class="shikimori-local__error">Ошибка поиска: ' + templates.escapeHtml(err.message) + '</div>');
  });
};

Search.prototype.updateQueryLabel = function () {
  const label = this.html.querySelector('.shikimori-local__query');
  if (label) label.textContent = this.currentQuery ? ('Запрос: ' + this.currentQuery) : '';
};

Search.prototype.renderResults = function (list, append) {
  const self = this;
  if (!append && (!list || list.length === 0)) {
    this.results.innerHTML = '<div class="shikimori-local__empty">Ничего не найдено</div>';
    return;
  }
  if (!list || list.length === 0) {
    this.ended = true;
    return;
  }
  list.forEach(function (anime) {
    self.results.appendChild(self.createCard(anime));
  });
  this.page += 1;
  this.addMoreButton();
  this.refocus();
};

Search.prototype.createCard = function (anime) {
  const self = this;
  const el = document.createElement('div');
  el.className = 'shikimori-local__result selector';
  el.innerHTML = '<img src="' + (anime.poster || '') + '" />' +
    '<div class="shikimori-local__result-info">' +
      '<div class="shikimori-local__result-title">' + templates.escapeHtml(anime.title) + '</div>' +
      '<div class="shikimori-local__result-meta">' + templates.escapeHtml(anime.original_title || '') + ' · ' + (anime.year || '?') + ' · ' + (anime.kind || '?') + ' · ' + (anime.score || '?') + '</div>' +
    '</div>';
  el.addEventListener('hover:enter', function () { self.openAnime(anime); });
  el.addEventListener('click', function () { self.openAnime(anime); });
  return el;
};

Search.prototype.addMoreButton = function () {
  const self = this;
  if (this.ended || this.results.querySelector('.shikimori-local__more')) return;
  const more = document.createElement('div');
  more.className = 'shikimori-local__more selector';
  more.textContent = 'Ещё';
  more.addEventListener('hover:enter', function () { self.doSearch(self.currentQuery, true); });
  more.addEventListener('click', function () { self.doSearch(self.currentQuery, true); });
  this.results.appendChild(more);
};

Search.prototype.removeMoreButton = function () {
  const more = this.results && this.results.querySelector('.shikimori-local__more');
  if (more) more.remove();
};

Search.prototype.refocus = function () {
  if (typeof Lampa !== 'undefined' && Lampa.Controller) {
    Lampa.Controller.collectionSet(this.html);
    const focused = this.html.querySelector('.selector.focus') || this.html.querySelector('.shikimori-local__result') || this.html.querySelector('[data-action="search"]');
    if (focused) Lampa.Controller.collectionFocus(focused, this.html);
  }
};

Search.prototype.openAnime = function (anime) {
  if (Lampa.Noty) Lampa.Noty.show('Поиск TMDB...');
  matcher.openBestOrFirst(anime).then(function (ok) {
    if (!ok && Lampa.Noty) Lampa.Noty.show('TMDB версия не найдена');
  }).catch(function (err) {
    logger.warn('openAnime error', err.message);
    if (Lampa.Noty) Lampa.Noty.show('Ошибка TMDB: ' + err.message);
  });
};

Search.prototype.render = function () {
  return this.html;
};

Search.prototype.destroy = function () {
  this.html = null;
  this.results = null;
};

module.exports = Search;
