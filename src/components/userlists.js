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
  this.lastCardFocus = null;
  this.selectedAnime = null;
}

UserLists.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = '<div class="shikimori-local userlists-page">' +
    '<div class="shikimori-local__head">Мои списки Shikimori</div>' +
    '<div class="shikimori-local__tabs"></div>' +
    '<div class="shikimori-local__results"></div>' +
  '</div>' +
  '<div class="shikimori-local__side-panel" aria-hidden="true"></div>';
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
  el.__shikimoriAnime = anime;
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
  more.__shikimoriMore = true;
  more.textContent = 'Ещё';
  more.addEventListener('hover:enter', function () { self.load(true); });
  more.addEventListener('click', function () { self.load(true); });
  this.results.appendChild(more);
};

UserLists.prototype.onFocusChange = function (focused) {
  if (focused && focused.__shikimoriAnime) {
    this.lastCardFocus = focused;
    this.selectedAnime = focused.__shikimoriAnime;
  }
};

UserLists.prototype.onRightEdge = function (focused) {
  if (!focused || !focused.__shikimoriAnime || !focused.getBoundingClientRect) return false;
  const rect = focused.getBoundingClientRect();
  const limit = (window.innerWidth || document.documentElement.clientWidth || 0) - 360;
  if (rect.right < limit) return false;
  this.lastCardFocus = focused;
  this.selectedAnime = focused.__shikimoriAnime;
  this.openSidePanel(this.selectedAnime);
  return true;
};

UserLists.prototype.onRightWall = function (focused) {
  return this.onRightEdge(focused);
};

UserLists.prototype.onLeftWall = function (focused) {
  const panel = this.html && this.html.querySelector('.shikimori-local__side-panel');
  if (panel && focused && panel.contains(focused)) {
    this.closeSidePanel(true);
    return true;
  }
  return false;
};

UserLists.prototype.openSidePanel = function (anime) {
  const panel = this.html && this.html.querySelector('.shikimori-local__side-panel');
  const root = this.html && this.html.querySelector('.userlists-page');
  if (!panel || !anime) return;
  if (root) root.classList.add('side-open');
  panel.innerHTML = this.buildSidePanelHtml(anime);
  panel.classList.add('visible');
  panel.setAttribute('aria-hidden', 'false');
  this.bindSidePanel(panel);
  const first = panel.querySelector('.selector') || panel;
  if (typeof Lampa !== 'undefined' && Lampa.Controller) Lampa.Controller.collectionFocus(first, this.html);
};

UserLists.prototype.closeSidePanel = function (restoreFocus) {
  const panel = this.html && this.html.querySelector('.shikimori-local__side-panel');
  const root = this.html && this.html.querySelector('.userlists-page');
  if (!panel) return;
  if (root) root.classList.remove('side-open');
  panel.classList.remove('visible');
  panel.querySelectorAll('.focus').forEach(function (el) { el.classList.remove('focus'); });
  panel.setAttribute('aria-hidden', 'true');
  if (restoreFocus && this.lastCardFocus && document.body.contains(this.lastCardFocus) && typeof Lampa !== 'undefined' && Lampa.Controller) {
    Lampa.Controller.collectionFocus(this.lastCardFocus, this.html);
  }
};

UserLists.prototype.buildSidePanelHtml = function (anime) {
  return '<div class="shikimori-local__side-title">' + templates.escapeHtml(anime.title) + '</div>' +
    '<div class="shikimori-local__side-item selector" data-side-action="planned">В планы</div>' +
    '<div class="shikimori-local__side-item selector" data-side-action="watching">Смотрю</div>' +
    '<div class="shikimori-local__side-item selector" data-side-action="completed">Просмотрено</div>' +
    '<div class="shikimori-local__side-item selector" data-side-action="score">Оценка</div>' +
    '<div class="shikimori-local__side-item selector" data-side-action="episodes">Эпизоды</div>' +
    '<div class="shikimori-local__side-item selector" data-side-action="delete">Удалить</div>';
};

UserLists.prototype.bindSidePanel = function (panel) {
  const self = this;
  panel.querySelectorAll('[data-side-action]').forEach(function (el) {
    const run = function () { self.handleSideAction(el.getAttribute('data-side-action')); };
    el.addEventListener('hover:enter', run);
    el.addEventListener('click', run);
  });
};

UserLists.prototype.handleSideAction = function (action) {
  const anime = this.selectedAnime;
  if (!anime) return;
  if (action === 'planned' || action === 'watching' || action === 'completed') return this.upsertRate(action);
  if (action === 'score') return this.askScore();
  if (action === 'episodes') return this.askEpisodes();
  if (action === 'delete') return this.deleteRate();
};

UserLists.prototype.saveRateResult = function (rate, fallbackStatus) {
  if (!this.selectedAnime || !rate) return;
  this.selectedAnime.rate_id = rate.rate_id || rate.id || this.selectedAnime.rate_id || 0;
  this.selectedAnime.user_rate_status = rate.user_rate_status || fallbackStatus || this.selectedAnime.user_rate_status || '';
  this.selectedAnime.user_score = rate.user_score || this.selectedAnime.user_score || 0;
  this.selectedAnime.user_episodes = rate.user_episodes || this.selectedAnime.user_episodes || 0;
};

UserLists.prototype.upsertRate = function (status) {
  const self = this;
  const anime = this.selectedAnime;
  if (!anime) return;
  const request = anime.rate_id ? userApi.updateAnimeRate(anime.rate_id, { status: status }) : userApi.createAnimeRate(anime.shikimori_id, status);
  request.then(function (rate) {
    self.saveRateResult(rate, status);
    if (Lampa.Noty) Lampa.Noty.show('Статус сохранён: ' + (userApi.RATE_STATUS_TITLES[status] || status));
  }).catch(function (err) {
    if (Lampa.Noty) Lampa.Noty.show('Ошибка Shikimori: ' + err.message);
  });
};

UserLists.prototype.askValue = function (title, value, onSave) {
  const save = function (v) { onSave(String(v || '').trim()); };
  if (Lampa.Input && Lampa.Input.edit) return Lampa.Input.edit({ title: title, value: String(value || ''), free: true }, save);
  save(prompt(title, String(value || '')));
};

UserLists.prototype.askScore = function () {
  const self = this;
  const anime = this.selectedAnime;
  if (!anime || !anime.rate_id) return Lampa.Noty && Lampa.Noty.show('Сначала добавьте тайтл в список');
  this.askValue('Оценка 0–10', anime.user_score || '', function (value) {
    const score = parseInt(value, 10);
    if (isNaN(score) || score < 0 || score > 10) return Lampa.Noty && Lampa.Noty.show('Оценка должна быть 0–10');
    userApi.updateAnimeRate(anime.rate_id, { score: score }).then(function (rate) {
      self.saveRateResult(rate);
      if (Lampa.Noty) Lampa.Noty.show('Оценка сохранена');
    }).catch(function (err) { if (Lampa.Noty) Lampa.Noty.show('Ошибка Shikimori: ' + err.message); });
  });
};

UserLists.prototype.askEpisodes = function () {
  const self = this;
  const anime = this.selectedAnime;
  if (!anime || !anime.rate_id) return Lampa.Noty && Lampa.Noty.show('Сначала добавьте тайтл в список');
  this.askValue('Просмотрено эпизодов', anime.user_episodes || '', function (value) {
    const episodes = parseInt(value, 10);
    if (isNaN(episodes) || episodes < 0) return Lampa.Noty && Lampa.Noty.show('Эпизоды должны быть числом');
    userApi.updateAnimeRate(anime.rate_id, { episodes: episodes }).then(function (rate) {
      self.saveRateResult(rate);
      if (Lampa.Noty) Lampa.Noty.show('Эпизоды сохранены');
    }).catch(function (err) { if (Lampa.Noty) Lampa.Noty.show('Ошибка Shikimori: ' + err.message); });
  });
};

UserLists.prototype.deleteRate = function () {
  const self = this;
  const anime = this.selectedAnime;
  if (!anime || !anime.rate_id) return Lampa.Noty && Lampa.Noty.show('Тайтл не найден в списке');
  userApi.deleteAnimeRate(anime.rate_id).then(function () {
    anime.rate_id = 0;
    anime.user_rate_status = '';
    anime.user_score = 0;
    anime.user_episodes = 0;
    if (self.lastCardFocus && self.lastCardFocus.parentNode) self.lastCardFocus.remove();
    self.closeSidePanel(false);
    if (Lampa.Noty) Lampa.Noty.show('Удалено из списка');
    self.refocus();
  }).catch(function (err) { if (Lampa.Noty) Lampa.Noty.show('Ошибка Shikimori: ' + err.message); });
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
