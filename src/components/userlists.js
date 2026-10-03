/**
 * Authenticated user anime lists.
 */
const auth = require('../auth');
const userApi = require('../api/user');
const templates = require('../ui/templates');
const logger = require('../logger');
const cards = require('../ui/cards');
const matcher = require('../mapping/matcher');
const client = require('../api/client');
const lifecycle = require('./lifecycle');
const motion = require('../ui/motion');

const CAROUSEL_LIMIT = 10;

const STATUSES = ['planned', 'watching', 'completed', 'on_hold', 'dropped'];
const CAROUSEL_GROUPS = {
  planned: [
    { id: 'ongoing', title: 'Выходит сейчас' },
    { id: 'released', title: 'Уже вышло' },
    { id: 'upcoming', status: 'anons', title: 'Ещё не вышло' }
  ],
  watching: [
    { id: 'ongoing', title: 'Выходит сейчас' },
    { id: 'released', title: 'Вышло полностью' }
  ]
};

function UserLists(params) {
  this.params = params || {};
  this.html = null;
  this.status = this.params.status || 'planned';
  this.page = 1;
  this.loading = false;
  this.results = null;
  this.pendingFocus = null;
  this.lastCardFocus = null;
  this.selectedAnime = null;
  this.requestScope = client.createScope('userlists');
  this.loadId = 0;
}

UserLists.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = '<div class="shikimori-local userlists-page">' +
    '<div class="shikimori-local__head">Мои списки Shikimori</div>' +
    '<div class="shikimori-local__tabs"></div>' +
    '<div class="shikimori-local__results"></div>' +
  '</div>';
  this.results = this.html.querySelector('.shikimori-local__results');
  this.renderTabs();
  this.load(false);
};

UserLists.prototype.renderTabs = function () {
  const self = this;
  const tabs = this.html.querySelector('.shikimori-local__tabs');
  if (tabs.children.length) {
    tabs.querySelectorAll('[data-tab]').forEach(function (tab) { tab.classList.toggle('active', tab.getAttribute('data-tab') === self.status); });
    return;
  }
  tabs.innerHTML = '';
  STATUSES.forEach(function (status) {
    const tab = document.createElement('div');
    tab.className = 'shikimori-local__tab selector' + (status === self.status ? ' active' : '');
    tab.textContent = userApi.RATE_STATUS_TITLES[status] || status;
    tab.setAttribute('data-tab', status);
    lifecycle.bindAction(tab, function () { self.changeStatus(status); });
    tabs.appendChild(tab);
  });
};

UserLists.prototype.changeStatus = function (status) {
  if (status === this.status) return;
  this.transitionDirection = STATUSES.indexOf(status) > STATUSES.indexOf(this.status) ? 1 : -1;
  this.status = status;
  this.pendingFocus = this.html.querySelector('[data-tab="' + status + '"]');
  this.renderTabs();
  this.load(false);
};

UserLists.prototype.load = function (append) {
  const self = this;
  if (append && this.loading) return;
  const loadId = ++this.loadId;
  client.cancelScope(this.requestScope);
  this.loading = false;
  const user = auth.getCachedUser();
  if (!auth.getToken()) {
    this.results.innerHTML = '<div class="shikimori-local__empty">Для списков войдите в аккаунт: настройки → ShikiLamp → Аккаунт Shikimori.</div>';
    this.refocus();
    return;
  }
  if (!user || !user.id) {
    this.results.innerHTML = '<div class="shikimori-local__empty">Нажмите «Проверить вход Shikimori» в настройках.</div>';
    this.refocus();
    return;
  }

  this.loading = true;
  this.results.innerHTML = '<div class="shikimori-local__loading">Загрузка списка...</div>';
  this.refocus();

  this.loadListData(user.id, { scope: this.requestScope }).then(function (list) {
    if (self.__shikimoriDestroyed || !self.html || loadId !== self.loadId) return;
    self.loading = false;
    self.renderResults(list || [], append);
  }).catch(function (err) {
    if (self.__shikimoriDestroyed || !self.html || loadId !== self.loadId) return;
    self.loading = false;
    if (typeof document !== 'undefined') {
      logger.warn('User list error', err.message);
      self.html.querySelectorAll('.shikimori-local__loading').forEach(function (el) { el.remove(); });
      self.results.innerHTML = '<div class="shikimori-local__error">' + templates.escapeHtml(err.message) + '</div>';
    }
    self.refocus();
  });
};

UserLists.prototype.loadListData = function (userId, options) {
  const groups = CAROUSEL_GROUPS[this.status];
  if (!groups) return userApi.listAllAnimeRates(userId, this.status, options);
  return Promise.all(groups.map(function (group) {
    return userApi.listMyListAnimes(this.status, group.status || group.id, 1, 50, options).then(function (list) {
      return { id: group.id, list: list };
    });
  }, this));
};

UserLists.prototype.renderResults = function (list, append) {
  const self = this;
  let firstNew = null;
  const groups = CAROUSEL_GROUPS[this.status];
  if (!append) this.results.innerHTML = '';
  if (!append && list.length === 0) {
    this.results.innerHTML = '<div class="shikimori-local__empty">Список пуст</div>';
    this.refocus();
    return;
  }
  const page = this.html.querySelector('.userlists-page');
  if (page) page.classList.toggle('grouped', !!groups);
  if (groups) {
    this.createCarouselGroups(groups);
    list.forEach(function (result) {
      const row = self.results.querySelector('[data-group="' + result.id + '"] .shikimori-local__row-items');
      result.list.slice(0, CAROUSEL_LIMIT).forEach(function (anime) {
        const card = self.createCard(anime);
        if (!firstNew) firstNew = card;
        row.appendChild(card);
      });
      if (result.list.length > CAROUSEL_LIMIT) {
        const group = groups.filter(function (item) { return item.id === result.id; })[0];
        self.addGroupMore(row, group.status || group.id);
      }
    });
  } else {
    const unique = this.uniqueAnimes(list);
    unique.forEach(function (anime) {
      const card = self.createCard(anime);
      if (!firstNew) firstNew = card;
      self.results.appendChild(card);
    });
  }

  if (append && firstNew) this.pendingFocus = firstNew;
  if (!append) motion.reveal(this.results, this.transitionDirection || 1);
  this.refocus();
};

UserLists.prototype.addGroupMore = function (row, groupStatus) {
  const self = this;
  const more = document.createElement('div');
  more.className = 'shikimori-local__more selector';
  more.textContent = 'Ещё';
  const open = function () {
    Lampa.Activity.push({
      url: '',
      title: userApi.RATE_STATUS_TITLES[self.status] || 'Мои списки Shikimori',
      component: 'shikimori_local_line',
      section: 'userlist',
      mylist: self.status,
      listStatus: groupStatus
    });
  };
  lifecycle.bindAction(more, open);
  row.appendChild(more);
};

UserLists.prototype.uniqueAnimes = function (list) {
  const renderedIds = {};
  this.results.querySelectorAll('.shikimori-local__result').forEach(function (card) {
    if (card.__shikimoriAnime && card.__shikimoriAnime.shikimori_id) {
      renderedIds[card.__shikimoriAnime.shikimori_id] = true;
    }
  });
  return list.filter(function (anime) {
    if (!anime || !anime.shikimori_id || renderedIds[anime.shikimori_id]) return false;
    renderedIds[anime.shikimori_id] = true;
    return true;
  });
};

UserLists.prototype.createCarouselGroups = function (groups) {
  const self = this;
  groups.forEach(function (group) {
    self.results.insertAdjacentHTML('beforeend', '<div class="shikimori-local__row" data-group="' + group.id + '">' +
      '<div class="shikimori-local__row-title">' + group.title + '</div>' +
      '<div class="shikimori-local__row-items"></div>' +
    '</div>');
  });
};

UserLists.prototype.createCard = function (anime) {
  const self = this;
  const progress = anime.user_episodes ? 'эп. ' + anime.user_episodes + '/' + (anime.episodes || '?') : '';
  const score = anime.user_score ? 'оценка ' + anime.user_score : '';
  const extra = [progress, score].filter(Boolean).join(' · ');
  return cards.createDomCard(anime, {
    extraMeta: extra,
    onEnter: function () { self.openAnime(anime); },
    onLongPress: function () { self.openShikimoriCard(anime); }
  });
};


UserLists.prototype.openAnime = function (anime) {
  const self = this;
  if (this.__shikimoriOpening) return;
  this.__shikimoriOpening = true;
  matcher.openBestOrFirst(anime, function () { return lifecycle.canFocus(self); }).then(function (ok) {
    self.__shikimoriOpening = false;
    if (!lifecycle.canFocus(self)) return;
    if (!ok) self.openShikimoriCard(anime);
  }).catch(function (err) {
    self.__shikimoriOpening = false;
    if (!lifecycle.canFocus(self)) return;
    logger.warn('open user list anime error', err.message);
    self.openShikimoriCard(anime);
  });
};

UserLists.prototype.openShikimoriCard = function (anime) {
  Lampa.Activity.push({
    url: '',
    title: anime.title,
    component: 'shikimori_local_anime',
    anime: anime
  });
};

UserLists.prototype.refocus = function () {
  lifecycle.refocus(this);
};

UserLists.prototype.render = function () {
  return this.html;
};

UserLists.prototype.destroy = function () {
  client.cancelScope(this.requestScope);
  this.html = null;
  this.results = null;
};

module.exports = UserLists;
