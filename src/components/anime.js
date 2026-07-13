/**
 * Anime detail component.
 */
const templates = require('../ui/templates');
const matcher = require('../mapping/matcher');
const storage = require('../mapping/storage');
const logger = require('../logger');
const userApi = require('../api/user');

function Anime(params) {
  this.params = params || {};
  this.html = null;
  this.anime = this.params.anime || {};
}

Anime.prototype.create = function () {
  const self = this;
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = templates.animeTemplate(this.anime);
  this.bindEvents();
  matcher.applyBestPoster(this.anime).then(function () {
    self.refreshView();
  });
};

Anime.prototype.bindEvents = function () {
  const self = this;
  this.html.querySelectorAll('[data-action]').forEach(function (el) {
    el.addEventListener('hover:enter', function () {
      const action = el.getAttribute('data-action');
      self.handleAction(action);
    });
    el.addEventListener('click', function () {
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
  }
};

Anime.prototype.toggleMenu = function (name) {
  this.html.querySelectorAll('.shikimori-local__dropdown.open').forEach(function (menu) {
    if (menu.getAttribute('data-menu') !== name) menu.classList.remove('open');
  });
  const menu = this.html.querySelector('[data-menu="' + name + '"]');
  const button = this.html.querySelector('[data-action="toggle-' + name + '"]');
  if (!menu) return;
  const willOpen = !menu.classList.contains('open');
  menu.classList.toggle('open', willOpen);
  if (button) button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  if (willOpen && typeof Lampa !== 'undefined' && Lampa.Controller) {
    const first = menu.querySelector('.selector.active') || menu.querySelector('.selector');
    if (first) Lampa.Controller.collectionFocus(first, this.html);
  }
};

Anime.prototype.closeMenus = function () {
  if (!this.html) return;
  this.html.querySelectorAll('.shikimori-local__dropdown.open').forEach(function (menu) { menu.classList.remove('open'); });
  this.html.querySelectorAll('[aria-expanded="true"]').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
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
  userApi.updateAnimeRate(this.anime.rate_id, { score: score }).then(function (rate) {
    self.setSaving(false);
    self.saveRateResult(rate);
    if (Lampa.Noty) Lampa.Noty.show(score ? 'Оценка сохранена' : 'Оценка удалена');
  }).catch(function (err) {
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
  const focusedAction = this.html.querySelector('.shikimori-local__action.focus');
  const action = focusedAction ? focusedAction.getAttribute('data-action') : '';
  this.html.innerHTML = templates.animeTemplate(this.anime);
  this.bindEvents();
  if (typeof Lampa !== 'undefined' && Lampa.Controller) {
    Lampa.Controller.collectionSet(this.html);
    const target = action ? this.html.querySelector('[data-action="' + action + '"]') : null;
    const focused = target || this.html.querySelector('.selector');
    if (focused) Lampa.Controller.collectionFocus(focused, this.html);
  }
};

Anime.prototype.upsertRate = function (status) {
  const self = this;
  const done = function (rate) {
    self.setSaving(false);
    self.saveRateResult(rate, status);
    if (Lampa.Noty) Lampa.Noty.show('ShikiLamp: статус сохранён — ' + (userApi.RATE_STATUS_TITLES[status] || status));
  };
  const fail = function (err) {
    self.setSaving(false);
    logger.warn('rate save error', err.message);
    if (Lampa.Noty) Lampa.Noty.show('Не удалось изменить статус' + formatErrorSuffix(err));
  };
  this.setSaving(true);
  if (this.anime.rate_id) {
    userApi.updateAnimeRate(this.anime.rate_id, { status: status }).then(done).catch(fail);
  } else {
    userApi.createAnimeRate(this.anime.shikimori_id, status).then(done).catch(fail);
  }
};

Anime.prototype.askValue = function (title, value, onSave) {
  const save = function (v) { onSave(String(v || '').trim()); };
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
    userApi.updateAnimeRate(self.anime.rate_id, { score: score }).then(function (rate) {
      self.saveRateResult(rate);
      if (Lampa.Noty) Lampa.Noty.show('Оценка сохранена');
    }).catch(function (err) {
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
    userApi.updateAnimeRate(self.anime.rate_id, { episodes: episodes }).then(function (rate) {
      self.saveRateResult(rate);
      if (Lampa.Noty) Lampa.Noty.show('Эпизоды сохранены');
    }).catch(function (err) {
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
  userApi.deleteAnimeRate(this.anime.rate_id).then(function () {
    self.setSaving(false);
    self.anime.rate_id = 0;
    self.anime.user_rate_status = '';
    self.anime.user_score = 0;
    self.anime.user_episodes = 0;
    self.refreshView();
    if (Lampa.Noty) Lampa.Noty.show('Удалено из списка Shikimori');
  }).catch(function (err) {
    self.setSaving(false);
    logger.warn('delete rate error', err.message);
    if (Lampa.Noty) Lampa.Noty.show('Не удалось удалить из списка' + formatErrorSuffix(err));
  });
};

Anime.prototype.openLampaSearch = function () {
  Lampa.Activity.push({
    url: '',
    title: 'Соответствие: ' + this.anime.title,
    component: 'shikimori_local_mapping',
    anime: this.anime
  });
};

Anime.prototype.findAndOpen = function () {
  const self = this;
  this.showLoading('Поиск соответствия в TMDB...');
  matcher.findBest(this.anime).then(function (out) {
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
    logger.warn('findAndOpen error', err.message);
    self.showError('Ошибка: ' + err.message);
  });
};

Anime.prototype.onFocusChange = function (focused) {
  if (!focused) return;
  const openMenu = this.html && this.html.querySelector('.shikimori-local__dropdown.open');
  if (openMenu && !openMenu.contains(focused) && !isDropdownButtonFor(focused, openMenu)) {
    this.closeMenus();
  }
};

Anime.prototype.onUp = function (focused) {
  const action = focused && focused.getAttribute('data-action');
  if (action === 'set-episodes') {
    this.bumpEpisodes(1);
    return true;
  }
  if (action === 'toggle-score-menu') {
    this.bumpScore(1);
    return true;
  }
  return false;
};

Anime.prototype.onDown = function (focused) {
  const action = focused && focused.getAttribute('data-action');
  if (action === 'set-episodes') {
    this.bumpEpisodes(-1);
    return true;
  }
  if (action === 'toggle-score-menu') {
    this.bumpScore(-1);
    return true;
  }
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
  userApi.updateAnimeRate(this.anime.rate_id, { episodes: episodes }).then(function (rate) {
    self.setSaving(false);
    self.saveRateResult(rate);
    if (Lampa.Noty) Lampa.Noty.show('Эпизоды: ' + episodes);
  }).catch(function (err) {
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
  this.html = null;
};

module.exports = Anime;
