/**
 * Shikimori home screen component.
 */
const api = require('../api');
const templates = require('../ui/templates');
const logger = require('../logger');
const cards = require('../ui/cards');
const matcher = require('../mapping/matcher');

const SECTIONS = [
  { id: 'ongoing', title: 'Сейчас на экранах', loader: api.ongoing }
];

function Home() {
  this.html = null;
  this.pages = {};
  this.loading = {};
  this.lastCardFocus = null;
}

Home.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = '<div class="shikimori-local home-page">' +
    '<div class="shikimori-local__head">ShikiLamp</div>' +
    '<div class="shikimori-local__tabs">' +
      '<div class="shikimori-local__tab selector active" data-tab="home">Сейчас на экранах</div>' +
      '<div class="shikimori-local__tab selector" data-tab="lists">Мои списки</div>' +
      '<div class="shikimori-local__tab selector" data-tab="filter">Фильтр</div>' +
    '</div>' +
    '<div class="shikimori-local__home-rows"></div>' +
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
    self.loadSection(section);
  });
};

Home.prototype.bindStaticEvents = function () {
  const self = this;
  this.html.querySelectorAll('[data-section="diagnostics"]').forEach(function (el) {
    el.addEventListener('hover:enter', function () { self.openSection(el.getAttribute('data-section')); });
    el.addEventListener('click', function () { self.openSection(el.getAttribute('data-section')); });
  });
  this.html.querySelectorAll('[data-tab]').forEach(function (el) {
    const run = function () { self.openTab(el.getAttribute('data-tab')); };
    el.addEventListener('hover:enter', run);
    el.addEventListener('click', run);
  });
};

Home.prototype.loadSection = function (section) {
  const self = this;
  const row = this.html.querySelector('[data-row="' + section.id + '"] .shikimori-local__row-items');
  if (!row || this.loading[section.id]) return;
  this.loading[section.id] = true;
  row.innerHTML = '<div class="shikimori-local__loading">Загрузка...</div>';

  section.loader(1).then(function (list) {
    self.loading[section.id] = false;
    row.innerHTML = '';
    self.renderSectionItems(section, row, list || []);
  }).catch(function (err) {
    self.loading[section.id] = false;
    logger.warn('Home row error', section.id, err.message);
    row.innerHTML = '<div class="shikimori-local__error">' + templates.escapeHtml(err.message) + '</div>';
  });
};

Home.prototype.renderSectionItems = function (section, row, list) {
  const self = this;
  if (list.length === 0) {
    row.innerHTML = '<div class="shikimori-local__empty">Нет данных</div>';
    return;
  }
  list.slice(0, 8).forEach(function (anime) {
    row.appendChild(self.createCard(anime));
  });
  const more = document.createElement('div');
  more.className = 'shikimori-local__more selector';
  more.textContent = 'Ещё';
  more.addEventListener('hover:enter', function () { self.openCatalog(section); });
  more.addEventListener('click', function () { self.openCatalog(section); });
  row.appendChild(more);
  this.refocus();
};

Home.prototype.createCard = function (anime) {
  const self = this;
  return cards.createDomCard(anime, {
    onEnter: function () { self.openAnime(anime); },
    onLongPress: function () { self.openShikimoriCard(anime); }
  });
};

Home.prototype.onFocusChange = function (focused) {
  if (focused && focused.__shikimoriAnime) this.lastCardFocus = focused;
};

Home.prototype.openTab = function (tab) {
  if (tab === 'lists') {
    Lampa.Activity.push({
      url: '',
      title: 'Мои списки Shikimori',
      component: 'shikimori_local_userlists'
    });
  }
  if (tab === 'filter') {
    Lampa.Activity.push({
      url: '',
      title: 'Фильтр Shikimori',
      component: 'shikimori_local_filter'
    });
  }
};
Home.prototype.openAnime = function (anime) {
  const self = this;
  matcher.openConfident(anime).then(function (ok) {
    if (!ok) self.openShikimoriCard(anime);
  }).catch(function (err) {
    logger.warn('openAnime error', err.message);
    self.openShikimoriCard(anime);
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

Home.prototype.openCatalog = function (section) {
  Lampa.Activity.push({
    url: '',
    title: 'Shikimori: ' + section.title,
    component: 'shikimori_local_line',
    section: section.id
  });
};

Home.prototype.openSection = function (section) {
  if (section === 'diagnostics') {
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
