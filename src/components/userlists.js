/**
 * Authenticated user anime lists.
 */
const auth = require('../auth');
const userApi = require('../api/user');
const templates = require('../ui/templates');
const logger = require('../logger');
const cards = require('../ui/cards');
const matcher = require('../mapping/matcher');

const STATUSES = ['planned', 'watching', 'completed', 'on_hold', 'dropped'];
const CAROUSEL_GROUPS = {
  planned: [
    { id: 'ongoing', title: 'Выходит сейчас' },
    { id: 'released', title: 'Уже вышло' },
    { id: 'upcoming', title: 'Ещё не вышло' }
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
    if (typeof document !== 'undefined') {
      logger.warn('User list error', err.message);
      self.html.querySelectorAll('.shikimori-local__loading').forEach(function (el) { el.remove(); });
      self.results.innerHTML = '<div class="shikimori-local__error">' + templates.escapeHtml(err.message) + '</div>';
    }
    self.refocus();
  });
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
  if (append) {
    const oldMore = this.results.querySelector('.shikimori-local__more');
    if (oldMore) {
      const moreRow = oldMore.closest ? oldMore.closest('.shikimori-local__row') : null;
      if (moreRow && CAROUSEL_GROUPS[this.status]) moreRow.remove();
      else oldMore.remove();
    }
  }

  const unique = this.uniqueAnimes(list);
  if (groups) {
    if (!append) this.createCarouselGroups(groups);
    groups.forEach(function (group) {
      const row = self.results.querySelector('[data-group="' + group.id + '"] .shikimori-local__row-items');
      self.sortByReleaseDate(unique.filter(function (anime) {
        return self.groupForAnime(anime) === group.id;
      })).forEach(function (anime) {
        const card = self.createCard(anime);
        if (!firstNew) firstNew = card;
        row.appendChild(card);
      });
      self.sortCarousel(row);
    });
  } else {
    unique.forEach(function (anime) {
      const card = self.createCard(anime);
      if (!firstNew) firstNew = card;
      self.results.appendChild(card);
    });
  }

  if (append && firstNew) this.pendingFocus = firstNew;
  this.page += 1;
  if (list.length < 20 || (append && unique.length === 0)) this.ended = true;
  if (!this.ended) this.appendMore();
  this.refocus();
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

UserLists.prototype.groupForAnime = function (anime) {
  if (this.status === 'planned') {
    const aired = parseInt(anime.episodes_aired, 10) || 0;
    const total = parseInt(anime.episodes, 10) || 0;
    if (aired === 0) return 'upcoming';
    return total > 0 && aired >= total ? 'released' : 'ongoing';
  }
  const status = String(anime.status || '').toLowerCase();
  if (status === 'ongoing') return 'ongoing';
  return 'released';
};

UserLists.prototype.sortByReleaseDate = function (list) {
  return list.sort(function (a, b) {
    return String(b.release_date || '').localeCompare(String(a.release_date || ''));
  });
};

UserLists.prototype.sortCarousel = function (row) {
  const cards = Array.prototype.slice.call(row.querySelectorAll('.shikimori-local__result'));
  cards.sort(function (a, b) {
    const first = a.__shikimoriAnime || {};
    const second = b.__shikimoriAnime || {};
    return String(second.release_date || '').localeCompare(String(first.release_date || ''));
  }).forEach(function (card) {
    row.appendChild(card);
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

UserLists.prototype.appendMore = function () {
  const self = this;
  const parent = CAROUSEL_GROUPS[this.status] ? this.createMoreRow() : this.results;
  const more = document.createElement('div');
  more.className = 'shikimori-local__more selector';
  more.__shikimoriMore = true;
  more.textContent = 'Ещё';
  more.addEventListener('hover:enter', function () { self.load(true); });
  more.addEventListener('click', function () { self.load(true); });
  parent.appendChild(more);
};

UserLists.prototype.createMoreRow = function () {
  const row = document.createElement('div');
  row.className = 'shikimori-local__row';
  const items = document.createElement('div');
  items.className = 'shikimori-local__row-items';
  row.appendChild(items);
  this.results.appendChild(row);
  return items;
};

UserLists.prototype.openAnime = function (anime) {
  const self = this;
  matcher.openBestOrFirst(anime).then(function (ok) {
    if (!ok) self.openShikimoriCard(anime);
  }).catch(function (err) {
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
  if (typeof Lampa === 'undefined' || !Lampa.Controller) return;
  Lampa.Controller.collectionSet(this.html);
  const focused = this.pendingFocus || this.html.querySelector('.selector.focus') || this.html.querySelector('.selector');
  this.pendingFocus = null;
  if (focused) {
    Lampa.Controller.collectionFocus(focused, this.html);
    if (focused.scrollIntoView) focused.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
