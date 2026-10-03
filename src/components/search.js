/**
 * Search component for Shikimori anime.
 */
const api = require('../api');
const templates = require('../ui/templates');
const logger = require('../logger');
const cards = require('../ui/cards');
const matcher = require('../mapping/matcher');
const client = require('../api/client');
const lifecycle = require('./lifecycle');
const motion = require('../ui/motion');

function Search(params) {
  this.params = params || {};
  this.html = null;
  this.results = null;
  this.currentQuery = this.params.query || '';
  this.page = 1;
  this.loading = false;
  this.ended = false;
  this.requestScope = client.createScope('search');
  this.loadId = 0;
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
  lifecycle.bindAction(btn, function () { self.askSearch(); });
};

Search.prototype.askSearch = function () {
  const self = this;
  if (typeof Lampa !== 'undefined' && Lampa.Input && Lampa.Input.edit) {
    Lampa.Input.edit({ title: 'Поиск Shikimori', value: this.currentQuery || '', free: true }, function (text) {
      if (!self.html || self.__shikimoriDestroyed || self.__shikimoriActive === false) return;
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
  if (!q || (append && this.loading)) return;
  if (!append) {
    this.loadId++;
    client.cancelScope(this.requestScope);
    this.page = 1;
    this.ended = false;
    this.results.innerHTML = '';
  }
  if (append && this.ended) return;
  const loadId = this.loadId;
  this.currentQuery = q;
  this.loading = true;
  this.removeMoreButton();
  this.results.querySelectorAll('.shikimori-local__error').forEach(function (el) { el.remove(); });
  this.updateQueryLabel();
  this.results.insertAdjacentHTML('beforeend', '<div class="shikimori-local__loading">Загрузка...</div>');
  this.refocus();
  api.search(q, this.page, { scope: this.requestScope }).then(function (list) {
    if (self.__shikimoriDestroyed || !self.html || loadId !== self.loadId) return;
    self.loading = false;
    self.html.querySelectorAll('.shikimori-local__loading').forEach(function (el) { el.remove(); });
    self.renderResults(list || [], append);
  }).catch(function (err) {
    if (self.__shikimoriDestroyed || !self.html || loadId !== self.loadId) return;
    self.loading = false;
    logger.warn('Search error', err.message);
    self.html.querySelectorAll('.shikimori-local__loading').forEach(function (el) { el.remove(); });
    self.results.insertAdjacentHTML('beforeend', '<div class="shikimori-local__error">Ошибка поиска: ' + templates.escapeHtml(err.message) + '</div>');
    self.addMoreButton(!append);
    self.refocus();
  });
};

Search.prototype.updateQueryLabel = function () {
  const label = this.html.querySelector('.shikimori-local__query');
  if (label) label.textContent = this.currentQuery ? ('Запрос: ' + this.currentQuery) : '';
};

Search.prototype.renderResults = function (list, append) {
  const self = this;
  let firstNew = null;
  if (!append && (!list || list.length === 0)) {
    this.results.innerHTML = '<div class="shikimori-local__empty">Ничего не найдено</div>';
    this.refocus();
    return;
  }
  if (!list || list.length === 0) {
    this.ended = true;
    this.refocus();
    return;
  }
  list.forEach(function (anime) {
    const card = self.createCard(anime);
    if (!firstNew) firstNew = card;
    self.results.appendChild(card);
  });
  if (append) this.pendingFocus = firstNew;
  this.page += 1;
  if (!append) motion.reveal(this.results);
  this.addMoreButton();
  this.refocus();
};

Search.prototype.createCard = function (anime) {
  const self = this;
  return cards.createDomCard(anime, {
    onEnter: function () { self.openAnime(anime); }
  });
};

Search.prototype.addMoreButton = function (retry) {
  const self = this;
  if (this.ended || this.results.querySelector('.shikimori-local__more')) return;
  const more = document.createElement('div');
  more.className = 'shikimori-local__more selector';
  more.textContent = retry ? 'Повторить' : 'Ещё';
  lifecycle.bindAction(more, function () { self.doSearch(self.currentQuery, !retry); });
  this.results.appendChild(more);
};

Search.prototype.removeMoreButton = function () {
  const more = this.results && this.results.querySelector('.shikimori-local__more');
  if (more) more.remove();
};

Search.prototype.refocus = function () {
  lifecycle.refocus(this);
};

Search.prototype.openAnime = function (anime) {
  if (this.__shikimoriOpening) return;
  this.__shikimoriOpening = true;
  const self = this;
  if (Lampa.Noty) Lampa.Noty.show('Поиск TMDB...');
  matcher.openBestOrFirst(anime, function () { return lifecycle.canFocus(self); }).then(function (ok) {
    this.__shikimoriOpening = false;
    if (!lifecycle.canFocus(this)) return;
    if (!ok && Lampa.Noty) Lampa.Noty.show('TMDB версия не найдена');
  }.bind(this)).catch(function (err) {
    this.__shikimoriOpening = false;
    if (!lifecycle.canFocus(this)) return;
    logger.warn('openAnime error', err.message);
    if (Lampa.Noty) Lampa.Noty.show('Ошибка TMDB: ' + err.message);
  }.bind(this));
};

Search.prototype.render = function () {
  return this.html;
};

Search.prototype.destroy = function () {
  client.cancelScope(this.requestScope);
  this.html = null;
  this.results = null;
};

module.exports = Search;
