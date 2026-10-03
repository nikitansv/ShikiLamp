/**
 * Anime detail component.
 */
const templates = require('../ui/templates');
const matcher = require('../mapping/matcher');
const titles = require('../mapping/titles');
const storage = require('../mapping/storage');
const logger = require('../logger');
const userApi = require('../api/user');
const client = require('../api/client');
const lifecycle = require('./lifecycle');
const motion = require('../ui/motion');
const cards = require('../ui/cards');

function Anime(params) {
  this.params = params || {};
  this.html = null;
  this.anime = this.params.anime || {};
  this.requestScope = client.createScope('anime');
}

Anime.prototype.create = function () {
  const self = this;
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = templates.animeTemplate(this.anime);
  cards.loadPoster(this.html.querySelector('.shikimori-local__poster img'), this.anime);
  this.bindEvents();
  matcher.applyBestPoster(this.anime).then(function () {
    if (self.__shikimoriDestroyed || !self.html) return;
    cards.loadPoster(self.html.querySelector('.shikimori-local__poster img'), self.anime);
  });
};

Anime.prototype.bindEvents = function () {
  const self = this;
  this.html.querySelectorAll('[data-action]').forEach(function (el) {
    lifecycle.bindAction(el, function () {
      const action = el.getAttribute('data-action');
      self.handleAction(action);
    });
  });
};

Anime.prototype.handleAction = function (action) {
  if (this.saving) return;
  if (action === 'tmdb') {
    this.findAndOpen();
  } else if (action === 'lampa-search') {
    this.openLampaSearch();
  } else if (action === 'mapping') {
    Lampa.Activity.push({
      url: '',
      title: 'Mapping: ' + this.anime.title,
      component: 'shikimori_local_mapping',
      anime: this.anime
    });
  } else if (action === 'toggle-status-menu') {
    this.toggleMenu('status-menu');
  } else if (action === 'toggle-score-menu') {
    this.toggleMenu('score-menu');
  } else if (action.indexOf('status-') === 0) {
    this.selectStatus(action.replace('status-', ''));
  } else if (action.indexOf('score-') === 0) {
    this.selectScore(action.replace('score-', ''));
  } else if (action === 'toggle-description') {
    this.toggleDescription();
  } else if (action === 'set-episodes') {
    this.askEpisodes();
  } else if (action === 'delete-rate') {
    this.confirmDeleteRate();
  } else if (action === 'external') {
    const url = this.anime.url || 'https://shikimori.io/animes/' + this.anime.shikimori_id;
    if (typeof Lampa !== 'undefined' && Lampa.Platform) {
      if (Lampa.Platform.is('android') && typeof AndroidJS !== 'undefined' && AndroidJS.openApp) {
        AndroidJS.openApp(url);
      } else {
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  } else if (action.indexOf('studio-') === 0) {
    Lampa.Activity.push({ url: '', title: 'Студия', component: 'shikimori_local_line', section: 'studio', studio: action.replace('studio-', '') });
  }
};

Anime.prototype.toggleMenu = function (name) {
  const self = this;
  const menu = this.html.querySelector('[data-menu="' + name + '"]');
  const button = this.html.querySelector('[data-action="toggle-' + name + '"]');
  if (!menu) return;
  const willOpen = !menu.classList.contains('open');
  if (willOpen) this.closeMenus();
  motion.dropdown(menu, willOpen, function () { lifecycle.scrollToFocus(self); });
  if (button) button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  lifecycle.refocus(this, willOpen ? menu.querySelector('.selector.active') || menu.querySelector('.selector') : button);
};

Anime.prototype.closeMenus = function (preferred) {
  if (!this.html) return;
  const self = this;
  const open = this.html.querySelector('.shikimori-local__dropdown.open');
  const name = open && open.getAttribute('data-menu');
  const focused = this.html.querySelector('.selector.focus');
  this.html.querySelectorAll('.shikimori-local__dropdown.open').forEach(function (menu) { motion.dropdown(menu, false, function () { lifecycle.scrollToFocus(self); }); });
  this.html.querySelectorAll('[aria-expanded="true"]').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
  if (open) lifecycle.refocus(this, preferred || (open.contains(focused) ? this.html.querySelector('[data-action="toggle-' + name + '"]') : focused));
};

Anime.prototype.onBack = function () {
  if (!this.html || !this.html.querySelector('.shikimori-local__dropdown.open')) return false;
  this.closeMenus();
  return true;
};

Anime.prototype.toggleDescription = function () {
  const text = this.html && this.html.querySelector('[data-description="text"]');
  const button = this.html && this.html.querySelector('[data-action="toggle-description"]');
  if (!text || !button) return;
  const expanded = text.classList.toggle('expanded');
  text.classList.toggle('collapsed', !expanded);
  button.textContent = expanded ? 'Свернуть' : 'Показать полностью';
};

Anime.prototype.selectStatus = function (status) {
  if (status === this.anime.user_rate_status) {
    this.closeMenus();
    return;
  }
  this.upsertRate(status);
};

Anime.prototype.selectScore = function (value) {
  const score = parseInt(value, 10);
  if (isNaN(score) || score < 0 || score > 10) return;
  if (!this.anime.rate_id) {
    if (Lampa.Noty) Lampa.Noty.show('Сначала добавьте тайтл в список');
    return;
  }
  if (score === Number(this.anime.user_score || 0)) {
    this.closeMenus();
    return;
  }
  this.setSaving(true);
  const self = this;
  userApi.updateAnimeRate(this.anime.rate_id, { score: score }, { scope: this.requestScope }).then(function (rate) {
    if (self.__shikimoriDestroyed || !self.html) return;
    self.setSaving(false);
    self.saveRateResult(rate);
    if (Lampa.Noty) Lampa.Noty.show(score ? 'Оценка сохранена' : 'Оценка удалена');
  }).catch(function (err) {
    if (self.__shikimoriDestroyed || !self.html) return;
    self.setSaving(false);
    logger.warn('score save error', err.message);
    if (Lampa.Noty) Lampa.Noty.show('Не удалось изменить оценку' + formatErrorSuffix(err));
  });
};

Anime.prototype.setSaving = function (state) {
  this.saving = !!state;
  if (!this.html) return;
  this.html.querySelectorAll('.shikimori-local__action, .shikimori-local__dropdown-item').forEach(function (el) {
    el.classList.toggle('disabled', !!state);
  });
  const focused = this.html.querySelector('.selector.focus');
  if (focused) focused.classList.toggle('loading', !!state);
};

Anime.prototype.confirmDeleteRate = function () {
  if (!this.anime.rate_id) {
    if (Lampa.Noty) Lampa.Noty.show('Тайтл не найден в списке');
    return;
  }
  if (typeof confirm === 'function' && !confirm('Удалить произведение из списка?')) return;
  this.deleteRate();
};

Anime.prototype.saveRateResult = function (rate, fallbackStatus) {
  if (rate) {
    this.anime.rate_id = rate.rate_id || rate.id || this.anime.rate_id || 0;
    this.anime.user_rate_status = rate.user_rate_status || fallbackStatus || this.anime.user_rate_status || '';
    this.anime.user_score = typeof rate.user_score === 'number' ? rate.user_score : (this.anime.user_score || 0);
    this.anime.user_episodes = typeof rate.user_episodes === 'number' ? rate.user_episodes : (this.anime.user_episodes || 0);
  }
  this.refreshView();
};

Anime.prototype.refreshView = function () {
  this.saving = false;
  if (!this.html) return;
  lifecycle.rememberFocus(this);
  const open = this.html.querySelector('.shikimori-local__dropdown.open');
  const menu = open && open.getAttribute('data-menu');
  const expanded = !!this.html.querySelector('.shikimori-local__description.expanded');
  this.html.innerHTML = templates.animeTemplate(this.anime);
  this.bindEvents();
  if (expanded) this.toggleDescription();
  if (menu) {
    this.html.querySelector('[data-menu="' + menu + '"]').classList.add('open');
    this.html.querySelector('[data-action="toggle-' + menu + '"]').setAttribute('aria-expanded', 'true');
  }
  lifecycle.refocus(this);
};

Anime.prototype.upsertRate = function (status) {
  const self = this;
  const done = function (rate) {
    if (self.__shikimoriDestroyed || !self.html) return;
    self.setSaving(false);
    self.saveRateResult(rate, status);
    if (Lampa.Noty) Lampa.Noty.show('ShikiLamp: статус сохранён — ' + (userApi.RATE_STATUS_TITLES[status] || status));
  };
  const fail = function (err) {
    if (self.__shikimoriDestroyed || !self.html) return;
    self.setSaving(false);
    logger.warn('rate save error', err.message);
    if (Lampa.Noty) Lampa.Noty.show('Не удалось изменить статус' + formatErrorSuffix(err));
  };
  this.setSaving(true);
  if (this.anime.rate_id) {
    userApi.updateAnimeRate(this.anime.rate_id, { status: status }, { scope: this.requestScope }).then(done).catch(fail);
  } else {
    userApi.createAnimeRate(this.anime.shikimori_id, status, { scope: this.requestScope }).then(done).catch(fail);
  }
};

Anime.prototype.askValue = function (title, value, onSave) {
  const self = this;
  const save = function (v) {
    if (v == null || !self.html || self.__shikimoriDestroyed || self.__shikimoriActive === false) return;
    onSave(String(v).trim());
  };
  if (Lampa.Input && Lampa.Input.edit) {
    Lampa.Input.edit({ title: title, value: String(value || ''), free: true }, save);
    return;
  }
  save(prompt(title, String(value || '')));
};

Anime.prototype.askScore = function () {
  const self = this;
  if (!this.anime.rate_id) {
    if (Lampa.Noty) Lampa.Noty.show('Сначала добавьте тайтл в список');
    return;
  }
  this.askValue('Оценка 0–10', this.anime.user_score || '', function (value) {
    const score = parseInt(value, 10);
    if (isNaN(score) || score < 0 || score > 10) {
      if (Lampa.Noty) Lampa.Noty.show('Оценка должна быть 0–10');
      return;
    }
    userApi.updateAnimeRate(self.anime.rate_id, { score: score }, { scope: self.requestScope }).then(function (rate) {
      if (self.__shikimoriDestroyed || !self.html) return;
      self.saveRateResult(rate);
      if (Lampa.Noty) Lampa.Noty.show('Оценка сохранена');
    }).catch(function (err) {
      if (self.__shikimoriDestroyed || !self.html) return;
      if (Lampa.Noty) Lampa.Noty.show('Ошибка Shikimori: ' + err.message);
    });
  });
};

Anime.prototype.askEpisodes = function () {
  const self = this;
  if (!this.anime.rate_id) {
    if (Lampa.Noty) Lampa.Noty.show('Сначала добавьте тайтл в список');
    return;
  }
  this.askValue('Просмотрено эпизодов', this.anime.user_episodes || '', function (value) {
    const episodes = parseInt(value, 10);
    if (isNaN(episodes) || episodes < 0) {
      if (Lampa.Noty) Lampa.Noty.show('Эпизоды должны быть числом');
      return;
    }
    userApi.updateAnimeRate(self.anime.rate_id, { episodes: episodes }, { scope: self.requestScope }).then(function (rate) {
      if (self.__shikimoriDestroyed || !self.html) return;
      self.saveRateResult(rate);
      if (Lampa.Noty) Lampa.Noty.show('Эпизоды сохранены');
    }).catch(function (err) {
      if (self.__shikimoriDestroyed || !self.html) return;
      if (Lampa.Noty) Lampa.Noty.show('Ошибка Shikimori: ' + err.message);
    });
  });
};

Anime.prototype.deleteRate = function () {
  const self = this;
  if (!this.anime.rate_id) {
    if (Lampa.Noty) Lampa.Noty.show('Тайтл не найден в списке');
    return;
  }
  this.setSaving(true);
  userApi.deleteAnimeRate(this.anime.rate_id, { scope: this.requestScope }).then(function () {
    if (self.__shikimoriDestroyed || !self.html) return;
    self.setSaving(false);
    self.anime.rate_id = 0;
    self.anime.user_rate_status = '';
    self.anime.user_score = 0;
    self.anime.user_episodes = 0;
    self.refreshView();
    if (Lampa.Noty) Lampa.Noty.show('Удалено из списка Shikimori');
  }).catch(function (err) {
    if (self.__shikimoriDestroyed || !self.html) return;
    self.setSaving(false);
    logger.warn('delete rate error', err.message);
    if (Lampa.Noty) Lampa.Noty.show('Не удалось удалить из списка' + formatErrorSuffix(err));
  });
};

Anime.prototype.openLampaSearch = function () {
  const self = this;
  const query = titles.baseTitle(this.anime.title || this.anime.original_title || this.anime.russian_title || '', this.anime.kind);
  if (typeof Lampa === 'undefined' || !Lampa.Search || !Lampa.Api || !Lampa.Api.availableDiscovery) {
    if (Lampa.Noty) Lampa.Noty.show('Поиск Lampa недоступен');
    return;
  }
  const sources = Lampa.Api.availableDiscovery().map(function (source) {
    const wrapped = Object.assign({}, source);
    wrapped.onSelect = function (event, done) {
      if (!self.html || self.__shikimoriDestroyed || self.__shikimoriActive === false) {
        if (done) done();
        return;
      }
      const item = event && (event.item_data || event.element);
      if (!item || !item.id) {
        if (Lampa.Noty) Lampa.Noty.show('Не удалось выбрать результат Lampa');
        if (done) done();
        return;
      }
      const type = item.name ? 'tv' : 'movie';
      const poster = item.poster_path ? matcher.tmdbPosterUrl(item.poster_path) : (item.poster || item.img || '');
      let mapping;
      try { mapping = matcher.saveManual(self.anime, item.id, type, 1, 0, { poster: poster }); }
      catch (err) {
        if (Lampa.Noty) Lampa.Noty.show('Не удалось сохранить соответствие');
        if (done) done();
        return;
      }
      self.refreshView();
      if (Lampa.Noty) Lampa.Noty.show('Соответствие сохранено');
      if (done) done();
      matcher.openLampaCard(self.anime, mapping);
    };
    return wrapped;
  });
  if (!sources.length) {
    if (Lampa.Noty) Lampa.Noty.show('Источники поиска Lampa не найдены');
    return;
  }
  Lampa.Search.open({ input: query, sources: sources });
};

Anime.prototype.findAndOpen = function () {
  const self = this;
  if (this.__shikimoriOpening) return;
  this.__shikimoriOpening = true;
  this.showLoading('Поиск соответствия в TMDB...');
  matcher.findBest(this.anime).then(function (out) {
    self.__shikimoriOpening = false;
    if (!lifecycle.canFocus(self)) return;
    if (out.result) {
      const ok = matcher.openLampaCard(self.anime, out.result);
      if (!ok) self.showError('Не удалось открыть карточку Lampa');
    } else {
      Lampa.Activity.push({
        url: '',
        title: 'Mapping: ' + self.anime.title,
        component: 'shikimori_local_mapping',
        anime: self.anime
      });
    }
  }).catch(function (err) {
    self.__shikimoriOpening = false;
    if (!lifecycle.canFocus(self)) return;
    logger.warn('findAndOpen error', err.message);
    self.showError('Ошибка: ' + err.message);
  });
};

Anime.prototype.onFocusChange = function (focused) {
  if (!focused) return;
  const openMenu = this.html && this.html.querySelector('.shikimori-local__dropdown.open');
  if (openMenu && !openMenu.contains(focused) && !isDropdownButtonFor(focused, openMenu)) {
    this.closeMenus(focused);
  }
};

Anime.prototype.onUp = function (focused) {
  return false;
};

Anime.prototype.onDown = function (focused) {
  return false;
};

function isDropdownButtonFor(focused, menu) {
  const name = menu.getAttribute('data-menu');
  return focused && focused.getAttribute && focused.getAttribute('data-action') === 'toggle-' + name;
}

function formatErrorSuffix(err) {
  if (!err) return '';
  const status = err.status || err.code || '';
  const message = err.message || '';
  if (status) return ' (' + status + ')';
  if (message) return ': ' + message.slice(0, 80);
  return '';
}

Anime.prototype.bumpScore = function (delta) {
  if (!this.anime.rate_id) {
    if (Lampa.Noty) Lampa.Noty.show('Сначала добавьте тайтл в список');
    return;
  }
  const current = Number(this.anime.user_score || 0);
  let next = current + delta;
  if (next < 0) next = 0;
  if (next > 10) next = 10;
  if (next === current) return;
  this.selectScore(String(next));
};

Anime.prototype.bumpEpisodes = function (delta) {
  if (!this.anime.rate_id) {
    if (Lampa.Noty) Lampa.Noty.show('Сначала добавьте тайтл в список');
    return;
  }
  const total = Number(this.anime.episodes || 0);
  const current = Number(this.anime.user_episodes || 0);
  let next = current + delta;
  if (next < 0) next = 0;
  if (total && next > total) next = total;
  if (next === current) return;
  this.saveEpisodes(next);
};

Anime.prototype.saveEpisodes = function (episodes) {
  const self = this;
  this.setSaving(true);
  userApi.updateAnimeRate(this.anime.rate_id, { episodes: episodes }, { scope: this.requestScope }).then(function (rate) {
    if (self.__shikimoriDestroyed || !self.html) return;
    self.setSaving(false);
    self.saveRateResult(rate);
    if (Lampa.Noty) Lampa.Noty.show('Эпизоды: ' + episodes);
  }).catch(function (err) {
    if (self.__shikimoriDestroyed || !self.html) return;
    self.setSaving(false);
    logger.warn('episodes save error', err.message);
    if (Lampa.Noty) Lampa.Noty.show('Не удалось изменить эпизоды' + formatErrorSuffix(err));
  });
};

Anime.prototype.showLoading = function (text) {
  if (Lampa.Noty) Lampa.Noty.show(text);
};

Anime.prototype.showError = function (text) {
  if (Lampa.Noty) Lampa.Noty.show(text);
};

Anime.prototype.render = function () {
  return this.html;
};

Anime.prototype.destroy = function () {
  client.cancelScope(this.requestScope);
  this.html = null;
};

module.exports = Anime;
