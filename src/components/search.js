/**
 * Search component for Shikimori anime.
 */
const api = require('../api');
const templates = require('../ui/templates');
const logger = require('../logger');
const normalizer = require('../api/normalizer');

function Search() {
  this.html = null;
  this.input = null;
  this.results = null;
  this.currentQuery = '';
}

Search.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = templates.searchTemplate();
  this.input = this.html.querySelector('.shikimori-local__input');
  this.results = this.html.querySelector('.shikimori-local__results');
  this.bindEvents();
};

Search.prototype.bindEvents = function () {
  const self = this;
  this.input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      self.doSearch(self.input.value);
    }
  });
  this.input.addEventListener('change', function () {
    self.doSearch(self.input.value);
  });
};

Search.prototype.doSearch = function (query) {
  const self = this;
  const q = String(query || '').trim();
  if (!q) return;
  this.currentQuery = q;
  this.results.innerHTML = '<div class="shikimori-local__loading">Загрузка...</div>';
  api.search(q).then(function (list) {
    self.renderResults(list);
  }).catch(function (err) {
    logger.warn('Search error', err.message);
    self.results.innerHTML = '<div class="shikimori-local__error">Ошибка поиска: ' + templates.escapeHtml(err.message) + '</div>';
  });
};

Search.prototype.renderResults = function (list) {
  const self = this;
  this.results.innerHTML = '';
  if (!list || list.length === 0) {
    this.results.innerHTML = '<div class="shikimori-local__empty">Ничего не найдено</div>';
    return;
  }
  list.forEach(function (anime) {
    const el = document.createElement('div');
    el.className = 'shikimori-local__result selector';
    el.innerHTML = '<img src="' + (anime.poster || '') + '" />' +
      '<div class="shikimori-local__result-info">' +
        '<div class="shikimori-local__result-title">' + templates.escapeHtml(anime.title) + '</div>' +
        '<div class="shikimori-local__result-meta">' + templates.escapeHtml(anime.original_title || '') + ' · ' + (anime.year || '?') + ' · ' + (anime.kind || '?') + ' · ' + (anime.score || '?') + ' · ' + anime.episodes + ' эп.</div>' +
      '</div>';
    el.addEventListener('hover:enter', function () {
      self.openAnime(anime);
    });
    el.addEventListener('click', function () {
      self.openAnime(anime);
    });
    self.results.appendChild(el);
  });
  Lampa.Controller.collectionSet(this.html);
  const first = this.results.querySelector('.shikimori-local__result');
  if (first) Lampa.Controller.collectionFocus(first, this.html);
};

Search.prototype.openAnime = function (anime) {
  Lampa.Activity.push({
    url: '',
    title: anime.title,
    component: 'shikimori_local_anime',
    anime: anime
  });
};

Search.prototype.render = function () {
  return this.html;
};

Search.prototype.destroy = function () {
  this.html = null;
};

module.exports = Search;
