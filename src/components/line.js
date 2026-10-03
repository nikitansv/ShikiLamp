/**
 * Line/catalog component for popular, ongoing, latest, announced.
 */
const api = require('../api');
const auth = require('../auth');
const userApi = require('../api/user');
const templates = require('../ui/templates');
const logger = require('../logger');
const cards = require('../ui/cards');
const matcher = require('../mapping/matcher');
const client = require('../api/client');
const lifecycle = require('./lifecycle');
const motion = require('../ui/motion');

function Line(params) {
  this.params = params || {};
  this.html = null;
  this.section = this.params.section || 'popular';
  this.studio = this.params.studio || '';
  this.filters = this.params.filters || null;
  this.mylist = this.params.mylist || '';
  this.listStatus = this.params.listStatus || '';
  this.page = 1;
  this.loading = false;
  this.ended = false;
  this.results = null;
  this.pendingFocus = null;
  this.nextList = null;
  this.requestScope = client.createScope('line');
  this.loadId = 0;
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
    case 'my_ongoing': return function (page, options) {
      const user = auth.getCachedUser();
      if (!auth.getToken() || !user || !user.id) return Promise.reject(new Error('Нужна авторизация Shikimori'));
      return userApi.listCurrentAnimeRates(user.id, page, 20, options);
    };
    case 'studio': return function (page, options) { return api.catalog({ studio: this.studio, order: 'ranked', page: page }, options); }.bind(this);
    case 'filter': return function (page, options) { return api.catalog(Object.assign({}, this.filters || {}, { page: page, order: (this.filters && this.filters.order) || 'ranked' }), options); }.bind(this);
    case 'userlist': return function (page, options) { return userApi.listMyListAnimes(this.mylist, this.listStatus, page, 50, options); }.bind(this);
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
    announced: 'Анонсы',
    my_ongoing: 'Сейчас на экранах — мои списки',
    studio: 'Аниме студии',
    filter: 'Каталог Shikimori',
    userlist: userApi.RATE_STATUS_TITLES[this.mylist] || 'Мои списки Shikimori'
  };
  return titles[section] || 'Shikimori';
};

Line.prototype.loadPage = function (append) {
  const self = this;
  if (append && (this.loading || this.ended)) return;
  if (!append) {
    this.loadId++;
    client.cancelScope(this.requestScope);
    this.page = 1;
    this.ended = false;
    this.nextList = null;
  }
  const loadId = this.loadId;
  if (append && this.nextList) {
    const buffered = this.nextList;
    this.nextList = null;
    this.removeMoreButton();
    this.renderResults(buffered, true);
    return;
  }
  this.loading = true;
  this.removeMoreButton();
  if (!append) this.results.innerHTML = '';
  this.results.insertAdjacentHTML('beforeend', '<div class="shikimori-local__loading">Загрузка...</div>');
  this.refocus();

  this.loaderFor(this.section)(this.page, { scope: this.requestScope }).then(function (list) {
    if (self.__shikimoriDestroyed || !self.html || loadId !== self.loadId) return;
    self.loading = false;
    self.html.querySelectorAll('.shikimori-local__loading').forEach(function (el) { el.remove(); });
    self.renderResults(list || [], append);
  }).catch(function (err) {
    if (self.__shikimoriDestroyed || !self.html || loadId !== self.loadId) return;
    self.loading = false;
    if (typeof document !== 'undefined') {
      logger.warn('Line error', err.message);
      self.html.querySelectorAll('.shikimori-local__loading').forEach(function (el) { el.remove(); });
      self.results.insertAdjacentHTML('beforeend', '<div class="shikimori-local__error">Ошибка загрузки: ' + templates.escapeHtml(err.message) + '</div>');
    }
    self.refocus();
  });
};

Line.prototype.renderResults = function (list, append) {
  const self = this;
  let firstNew = null;
  if (!append && (!list || list.length === 0)) {
    this.results.innerHTML = '<div class="shikimori-local__empty">Нет данных</div>';
    this.refocus();
    return;
  }
  if (!list || list.length === 0) {
    this.ended = true;
    this.refocus();
    return;
  }
  const renderedIds = {};
  this.results.querySelectorAll('.shikimori-local__result').forEach(function (card) {
    if (card.__shikimoriAnime && card.__shikimoriAnime.shikimori_id) {
      renderedIds[card.__shikimoriAnime.shikimori_id] = true;
    }
  });
  const unique = list.filter(function (anime) {
    if (!anime || !anime.shikimori_id || renderedIds[anime.shikimori_id]) return false;
    renderedIds[anime.shikimori_id] = true;
    return true;
  });
  unique.forEach(function (anime) {
    const card = self.createCard(anime);
    if (!firstNew) firstNew = card;
    self.results.appendChild(card);
  });
  if (append && firstNew) this.pendingFocus = firstNew;
  this.page += 1;
  if (!append) motion.reveal(this.results);
  this.refocus();
  this.probeNextPage();
};

Line.prototype.probeNextPage = function () {
  const self = this;
  const page = this.page;
  const loadId = this.loadId;
  this.loaderFor(this.section)(page, { scope: this.requestScope }).then(function (list) {
    if (self.__shikimoriDestroyed || !self.results || page !== self.page || loadId !== self.loadId) return;
    const rendered = {};
    self.results.querySelectorAll('.shikimori-local__result').forEach(function (card) {
      if (card.__shikimoriAnime) rendered[card.__shikimoriAnime.shikimori_id] = true;
    });
    self.nextList = (list || []).filter(function (anime) {
      return anime && anime.shikimori_id && !rendered[anime.shikimori_id];
    });
    self.ended = self.nextList.length === 0;
    if (!self.ended) self.addMoreButton();
    self.refocus();
  }).catch(function (err) {
    if (self.__shikimoriDestroyed || !self.html || loadId !== self.loadId) return;
    logger.warn('Line next page probe error', err.message);
  });
};

Line.prototype.createCard = function (anime) {
  const self = this;
  return cards.createDomCard(anime, {
    onEnter: function () { self.openAnime(anime); },
    onLongPress: function () { self.openShikimoriCard(anime); }
  });
};

Line.prototype.addMoreButton = function () {
  const self = this;
  if (this.ended || this.results.querySelector('.shikimori-local__more')) return;
  const more = document.createElement('div');
  more.className = 'shikimori-local__more selector';
  more.textContent = 'Ещё';
  lifecycle.bindAction(more, function () { self.loadPage(true); });
  this.results.appendChild(more);
};

Line.prototype.removeMoreButton = function () {
  const more = this.results && this.results.querySelector('.shikimori-local__more');
  if (more) more.remove();
};

Line.prototype.refocus = function () {
  lifecycle.refocus(this);
};

Line.prototype.forceFocus = function (target) {
  lifecycle.refocus(this, target);
};

Line.prototype.openAnime = function (anime) {
  const self = this;
  if (this.__shikimoriOpening) return;
  this.__shikimoriOpening = true;
  matcher.openConfident(anime, function () { return lifecycle.canFocus(self); }).then(function (ok) {
    self.__shikimoriOpening = false;
    if (!lifecycle.canFocus(self)) return;
    if (!ok) self.openShikimoriCard(anime);
  }).catch(function (err) {
    self.__shikimoriOpening = false;
    if (!lifecycle.canFocus(self)) return;
    logger.warn('openAnime error', err.message);
    self.openShikimoriCard(anime);
  });
};

Line.prototype.openShikimoriCard = function (anime) {
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
  client.cancelScope(this.requestScope);
  this.html = null;
  this.results = null;
};

module.exports = Line;
