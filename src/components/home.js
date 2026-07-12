/**
 * Shikimori home screen component.
 */
const api = require('../api');
const templates = require('../ui/templates');
const logger = require('../logger');
const matcher = require('../mapping/matcher');

const SECTIONS = [
  { id: 'latest', title: 'Недавно вышедшее', loader: api.latest },
  { id: 'ongoing', title: 'Онгоинги', loader: api.ongoing },
  { id: 'popular', title: 'Популярное', loader: api.popular },
  { id: 'plans', title: 'Планы', loader: null }
];

function Home() {
  this.html = null;
  this.pages = {};
  this.loading = {};
}

Home.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = '<div class="shikimori-local home-page">' +
    '<div class="shikimori-local__head">ShikiLamp</div>' +
    '<div class="shikimori-local__home-rows"></div>' +
    '<div class="shikimori-local__section selector" data-section="mappings">Локальные соответствия</div>' +
    '<div class="shikimori-local__section selector" data-section="diagnostics">Диагностика</div>' +
  '</div>';
  this.renderRows();
  this.bindStaticEvents();
};

Home.prototype.renderRows = function () {
  const wrap = this.html.querySelector('.shikimori-local__home-rows');
  wrap.innerHTML = '';
  const self = this;
  SECTIONS.forEach(function (section) {
    self.pages[section.id] = 1;
    wrap.insertAdjacentHTML('beforeend', '<div class="shikimori-local__row" data-row="' + section.id + '">' +
      '<div class="shikimori-local__row-title">' + section.title + '</div>' +
      '<div class="shikimori-local__row-items"></div>' +
    '</div>');
    self.loadSection(section, false);
  });
};

Home.prototype.bindStaticEvents = function () {
  const self = this;
  this.html.querySelectorAll('[data-section="mappings"], [data-section="diagnostics"]').forEach(function (el) {
    el.addEventListener('hover:enter', function () { self.openSection(el.getAttribute('data-section')); });
    el.addEventListener('click', function () { self.openSection(el.getAttribute('data-section')); });
  });
};

Home.prototype.loadSection = function (section, append) {
  const self = this;
  const row = this.html.querySelector('[data-row="' + section.id + '"] .shikimori-local__row-items');
  if (!row || this.loading[section.id]) return;
  this.loading[section.id] = true;
  const more = row.querySelector('.shikimori-local__more');
  if (more) more.remove();

  if (section.id === 'plans') {
    this.loading[section.id] = false;
    row.innerHTML = '<div class="shikimori-local__empty">Планы Shikimori требуют авторизацию. Добавлю после токена/OAuth.</div>';
    return;
  }

  row.insertAdjacentHTML('beforeend', '<div class="shikimori-local__loading">Загрузка...</div>');
  section.loader(this.pages[section.id]).then(function (list) {
    self.loading[section.id] = false;
    row.querySelectorAll('.shikimori-local__loading').forEach(function (el) { el.remove(); });
    self.renderSectionItems(section, row, list || []);
  }).catch(function (err) {
    self.loading[section.id] = false;
    logger.warn('Home row error', section.id, err.message);
    row.querySelectorAll('.shikimori-local__loading').forEach(function (el) { el.remove(); });
    row.insertAdjacentHTML('beforeend', '<div class="shikimori-local__error">' + templates.escapeHtml(err.message) + '</div>');
  });
};

Home.prototype.renderSectionItems = function (section, row, list) {
  const self = this;
  if (list.length === 0 && this.pages[section.id] === 1) {
    row.innerHTML = '<div class="shikimori-local__empty">Нет данных</div>';
    return;
  }
  list.forEach(function (anime) {
    row.appendChild(self.createCard(anime));
  });
  this.pages[section.id] += 1;
  const more = document.createElement('div');
  more.className = 'shikimori-local__more selector';
  more.textContent = 'Ещё';
  more.addEventListener('hover:enter', function () { self.loadSection(section, true); });
  more.addEventListener('click', function () { self.loadSection(section, true); });
  row.appendChild(more);
  this.refocus();
};

Home.prototype.createCard = function (anime) {
  const self = this;
  const el = document.createElement('div');
  el.className = 'shikimori-local__result selector';
  el.innerHTML = '<img src="' + (anime.poster || '') + '" />' +
    '<div class="shikimori-local__result-title">' + templates.escapeHtml(anime.title) + '</div>' +
    '<div class="shikimori-local__result-meta">' + (anime.year || '?') + ' · ' + (anime.kind || '?') + ' · ' + (anime.score || '?') + '</div>';
  el.addEventListener('hover:enter', function () { self.openAnime(anime); });
  el.addEventListener('click', function () { self.openAnime(anime); });
  el.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    self.openShikimoriCard(anime);
  });
  return el;
};

Home.prototype.openAnime = function (anime) {
  if (Lampa.Noty) Lampa.Noty.show('Поиск TMDB...');
  matcher.openBestOrFirst(anime).then(function (ok) {
    if (!ok && Lampa.Noty) Lampa.Noty.show('TMDB версия не найдена');
  }).catch(function (err) {
    logger.warn('openAnime error', err.message);
    if (Lampa.Noty) Lampa.Noty.show('Ошибка TMDB: ' + err.message);
  });
};

Home.prototype.openShikimoriCard = function (anime) {
  Lampa.Activity.push({
    url: '',
    title: anime.title,
    component: 'shikimori_local_anime',
    anime: anime
  });
};

Home.prototype.openSection = function (section) {
  if (section === 'mappings') {
    Lampa.Activity.push({ url: '', title: 'Локальные соответствия', component: 'shikimori_local_mappings' });
  } else if (section === 'diagnostics') {
    Lampa.Activity.push({ url: '', title: 'Диагностика Shikimori', component: 'shikimori_local_diagnostics' });
  }
};

Home.prototype.refocus = function () {
  if (typeof Lampa !== 'undefined' && Lampa.Controller) {
    Lampa.Controller.collectionSet(this.html);
    const focused = this.html.querySelector('.selector.focus') || this.html.querySelector('.selector');
    if (focused) Lampa.Controller.collectionFocus(focused, this.html);
  }
};

Home.prototype.render = function () {
  return this.html;
};

Home.prototype.destroy = function () {
  this.html = null;
};

module.exports = Home;
