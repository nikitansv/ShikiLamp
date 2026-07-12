/**
 * Line/catalog component for popular, ongoing, latest, announced.
 */
const api = require('../api');
const templates = require('../ui/templates');
const logger = require('../logger');
const matcher = require('../mapping/matcher');

function Line(params) {
  this.params = params || {};
  this.html = null;
  this.section = this.params.section || 'popular';
  this.page = 1;
  this.loading = false;
  this.ended = false;
  this.results = null;
}

Line.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = '<div class="shikimori-local line-page">' +
    '<div class="shikimori-local__head">' + this.titleFor(this.section) + '</div>' +
    '<div class="shikimori-local__results"></div>' +
  '</div>';
  this.results = this.html.querySelector('.shikimori-local__results');
  this.loadPage(false);
};

Line.prototype.loaderFor = function (section) {
  switch (section) {
    case 'ongoing': return api.ongoing;
    case 'latest': return api.latest;
    case 'announced': return api.announced;
    default: return api.popular;
  }
};

Line.prototype.titleFor = function (section) {
  const titles = {
    popular: 'Популярное',
    ongoing: 'Онгоинги',
    latest: 'Недавно вышедшее',
    announced: 'Анонсы'
  };
  return titles[section] || 'Shikimori';
};

Line.prototype.loadPage = function (append) {
  const self = this;
  if (this.loading || (append && this.ended)) return;
  this.loading = true;
  this.removeMoreButton();
  if (!append) this.results.innerHTML = '';
  this.results.insertAdjacentHTML('beforeend', '<div class="shikimori-local__loading">Загрузка...</div>');

  this.loaderFor(this.section)(this.page).then(function (list) {
    self.loading = false;
    self.html.querySelectorAll('.shikimori-local__loading').forEach(function (el) { el.remove(); });
    self.renderResults(list || [], append);
  }).catch(function (err) {
    self.loading = false;
    logger.warn('Line error', err.message);
    self.html.querySelectorAll('.shikimori-local__loading').forEach(function (el) { el.remove(); });
    self.results.insertAdjacentHTML('beforeend', '<div class="shikimori-local__error">Ошибка загрузки: ' + templates.escapeHtml(err.message) + '</div>');
  });
};

Line.prototype.renderResults = function (list, append) {
  const self = this;
  if (!append && (!list || list.length === 0)) {
    this.results.innerHTML = '<div class="shikimori-local__empty">Нет данных</div>';
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

Line.prototype.createCard = function (anime) {
  const self = this;
  const el = document.createElement('div');
  el.className = 'shikimori-local__result selector';
  el.innerHTML = '<img src="' + (anime.poster || '') + '" />' +
    '<div class="shikimori-local__result-info">' +
      '<div class="shikimori-local__result-title">' + templates.escapeHtml(anime.title) + '</div>' +
      '<div class="shikimori-local__result-meta">' + (anime.year || '?') + ' · ' + (anime.kind || '?') + ' · ' + (anime.score || '?') + '</div>' +
    '</div>';
  el.addEventListener('hover:enter', function () { self.openAnime(anime); });
  el.addEventListener('click', function () { self.openAnime(anime); });
  return el;
};

Line.prototype.addMoreButton = function () {
  const self = this;
  if (this.ended || this.results.querySelector('.shikimori-local__more')) return;
  const more = document.createElement('div');
  more.className = 'shikimori-local__more selector';
  more.textContent = 'Ещё';
  more.addEventListener('hover:enter', function () { self.loadPage(true); });
  more.addEventListener('click', function () { self.loadPage(true); });
  this.results.appendChild(more);
};

Line.prototype.removeMoreButton = function () {
  const more = this.results && this.results.querySelector('.shikimori-local__more');
  if (more) more.remove();
};

Line.prototype.refocus = function () {
  if (typeof Lampa !== 'undefined' && Lampa.Controller) {
    Lampa.Controller.collectionSet(this.html);
    const focused = this.html.querySelector('.selector.focus') || this.html.querySelector('.shikimori-local__result');
    if (focused) Lampa.Controller.collectionFocus(focused, this.html);
  }
};

Line.prototype.openAnime = function (anime) {
  if (Lampa.Noty) Lampa.Noty.show('Поиск TMDB...');
  matcher.openBestOrFirst(anime).then(function (ok) {
    if (!ok && Lampa.Noty) Lampa.Noty.show('TMDB версия не найдена');
  }).catch(function (err) {
    logger.warn('openAnime error', err.message);
    if (Lampa.Noty) Lampa.Noty.show('Ошибка TMDB: ' + err.message);
  });
};

Line.prototype.render = function () {
  return this.html;
};

Line.prototype.destroy = function () {
  this.html = null;
  this.results = null;
};

module.exports = Line;
