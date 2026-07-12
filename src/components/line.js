/**
 * Line/catalog component for popular, ongoing, latest, announced.
 */
const api = require('../api');
const templates = require('../ui/templates');
const logger = require('../logger');

function Line(params) {
  this.params = params || {};
  this.html = null;
  this.section = this.params.section || 'popular';
}

Line.prototype.create = function () {
  const self = this;
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = '<div class="shikimori-local line-page">' +
    '<div class="shikimori-local__head">' + this.titleFor(this.section) + '</div>' +
    '<div class="shikimori-local__results"></div>' +
  '</div>';
  const results = this.html.querySelector('.shikimori-local__results');
  results.innerHTML = '<div class="shikimori-local__loading">Загрузка...</div>';

  const loader = this.loaderFor(this.section);
  loader().then(function (list) {
    self.renderResults(list);
  }).catch(function (err) {
    logger.warn('Line error', err.message);
    results.innerHTML = '<div class="shikimori-local__error">Ошибка загрузки: ' + templates.escapeHtml(err.message) + '</div>';
  });
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

Line.prototype.renderResults = function (list) {
  const self = this;
  const results = this.html.querySelector('.shikimori-local__results');
  results.innerHTML = '';
  if (!list || list.length === 0) {
    results.innerHTML = '<div class="shikimori-local__empty">Нет данных</div>';
    return;
  }
  list.forEach(function (anime) {
    const el = document.createElement('div');
    el.className = 'shikimori-local__result selector';
    el.innerHTML = '<img src="' + (anime.poster || '') + '" />' +
      '<div class="shikimori-local__result-info">' +
        '<div class="shikimori-local__result-title">' + templates.escapeHtml(anime.title) + '</div>' +
        '<div class="shikimori-local__result-meta">' + (anime.year || '?') + ' · ' + (anime.kind || '?') + ' · ' + (anime.score || '?') + '</div>' +
      '</div>';
    el.addEventListener('hover:enter', function () {
      self.openAnime(anime);
    });
    el.addEventListener('click', function () {
      self.openAnime(anime);
    });
    results.appendChild(el);
  });
  Lampa.Controller.collectionSet(this.html);
  const first = results.querySelector('.shikimori-local__result');
  if (first) Lampa.Controller.collectionFocus(first, this.html);
};

Line.prototype.openAnime = function (anime) {
  Lampa.Activity.push({
    url: '',
    title: anime.title,
    component: 'shikimori_local_anime',
    anime: anime
  });
};

Line.prototype.render = function () {
  return this.html;
};

Line.prototype.destroy = function () {
  this.html = null;
};

module.exports = Line;
