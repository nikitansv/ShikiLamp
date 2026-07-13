/**
 * Authenticated user anime lists.
 */
const auth = require('../auth');
const userApi = require('../api/user');
const templates = require('../ui/templates');
const logger = require('../logger');
const matcher = require('../mapping/matcher');

const STATUSES = ['planned', 'watching', 'completed', 'on_hold', 'dropped'];

function UserLists(params) {
  this.params = params || {};
  this.html = null;
  this.status = this.params.status || 'planned';
  this.page = 1;
  this.loading = false;
  this.ended = false;
  this.results = null;
  this.pendingFocus = null;
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
  tabs.innerHTML = '';
  STATUSES.forEach(function (status) {
    const tab = document.createElement('div');
    tab.className = 'shikimori-local__tab selector' + (status === self.status ? ' active' : '');
    tab.textContent = userApi.RATE_STATUS_TITLES[status] || status;
    tab.addEventListener('hover:enter', function () { self.changeStatus(status); });
    tab.addEventListener('click', function () { self.changeStatus(status); });
    tabs.appendChild(tab);
  });
};

UserLists.prototype.changeStatus = function (status) {
  if (status === this.status) return;
  this.status = status;
  this.page = 1;
  this.ended = false;
  this.pendingFocus = null;
  this.renderTabs();
  this.load(false);
};

UserLists.prototype.load = function (append) {
  const self = this;
  if (this.loading || this.ended) return;
  const user = auth.getCachedUser();
  if (!auth.getToken()) {
    this.results.innerHTML = '<div class="shikimori-local__empty">Нужна авторизация: настройки → ShikiLamp Local → ввести access token.</div>';
    this.refocus();
    return;
  }
  if (!user || !user.id) {
    this.results.innerHTML = '<div class="shikimori-local__empty">Нажмите «Проверить вход Shikimori» в настройках.</div>';
    this.refocus();
    return;
  }

  this.loading = true;
  if (!append) this.results.innerHTML = '<div class="shikimori-local__loading">Загрузка...</div>';

  userApi.listAnimeRates(user.id, this.status, this.page, 20).then(function (list) {
    self.loading = false;
    self.renderResults(list || [], append);
  }).catch(function (err) {
    self.loading = false;
    logger.warn('User list error', err.message);
    self.results.innerHTML = '<div class="shikimori-local__error">' + templates.escapeHtml(err.message) + '</div>';
    self.refocus();
  });
};

UserLists.prototype.renderResults = function (list, append) {
  const self = this;
  let firstNew = null;
  if (!append) this.results.innerHTML = '';
  if (!append && list.length === 0) {
    this.results.innerHTML = '<div class="shikimori-local__empty">Список пуст</div>';
    this.refocus();
    return;
  }
  if (append) {
    const oldMore = this.results.querySelector('.shikimori-local__more');
    if (oldMore) oldMore.remove();
  }

  list.forEach(function (anime) {
    const card = self.createCard(anime);
    if (!firstNew) firstNew = card;
    self.results.appendChild(card);
  });

  if (append && firstNew) this.pendingFocus = firstNew;
  this.page += 1;
  if (list.length < 20) this.ended = true;
  if (!this.ended) this.appendMore();
  this.refocus();
};

UserLists.prototype.createCard = function (anime) {
  const self = this;
  const el = document.createElement('div');
  el.className = 'shikimori-local__result selector';
  const progress = anime.user_episodes ? ' · эп. ' + anime.user_episodes + '/' + (anime.episodes || '?') : '';
  const score = anime.user_score ? ' · оценка ' + anime.user_score : '';
  el.innerHTML = '<img src="' + (anime.poster || '') + '" />' +
    '<div class="shikimori-local__result-title">' + templates.escapeHtml(anime.title) + '</div>' +
    '<div class="shikimori-local__result-meta">' + (anime.year || '?') + ' · ' + (anime.kind || '?') + progress + score + '</div>';
  el.addEventListener('hover:enter', function () { self.openAnime(anime); });
  el.addEventListener('click', function () { self.openAnime(anime); });
  el.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    self.openShikimoriCard(anime);
  });
  return el;
};

UserLists.prototype.appendMore = function () {
  const self = this;
  const more = document.createElement('div');
  more.className = 'shikimori-local__more selector';
  more.textContent = 'Ещё';
  more.addEventListener('hover:enter', function () { self.load(true); });
  more.addEventListener('click', function () { self.load(true); });
  this.results.appendChild(more);
};

UserLists.prototype.openAnime = function (anime) {
  if (Lampa.Noty) Lampa.Noty.show('Поиск TMDB...');
  matcher.openBestOrFirst(anime).then(function (ok) {
    if (!ok && Lampa.Noty) Lampa.Noty.show('TMDB версия не найдена');
  }).catch(function (err) {
    logger.warn('open user list anime error', err.message);
    if (Lampa.Noty) Lampa.Noty.show('Ошибка TMDB: ' + err.message);
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
  if (typeof Lampa === 'undefined' || !Lampa.Controller) return;
  Lampa.Controller.collectionSet(this.html);
  const focused = this.pendingFocus || this.html.querySelector('.selector.focus') || this.html.querySelector('.selector');
  this.pendingFocus = null;
  if (focused) {
    Lampa.Controller.collectionFocus(focused, this.html);
    if (focused.scrollIntoView) focused.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
};

UserLists.prototype.render = function () {
  return this.html;
};

UserLists.prototype.destroy = function () {
  this.html = null;
  this.results = null;
};

module.exports = UserLists;
