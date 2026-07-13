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
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = templates.animeTemplate(this.anime);
  this.bindEvents();
};

Anime.prototype.bindEvents = function () {
  const self = this;
  this.html.querySelectorAll('.shikimori-local__action').forEach(function (el) {
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
  if (action === 'tmdb') {
    this.findAndOpen();
  } else if (action === 'mapping') {
    Lampa.Activity.push({
      url: '',
      title: 'Mapping: ' + this.anime.title,
      component: 'shikimori_local_mapping',
      anime: this.anime
    });
  } else if (action === 'add-planned') {
    this.upsertRate('planned');
  } else if (action === 'add-watching') {
    this.upsertRate('watching');
  } else if (action === 'add-completed') {
    this.upsertRate('completed');
  } else if (action === 'add-on_hold') {
    this.upsertRate('on_hold');
  } else if (action === 'add-dropped') {
    this.upsertRate('dropped');
  } else if (action === 'set-score') {
    this.askScore();
  } else if (action === 'set-episodes') {
    this.askEpisodes();
  } else if (action === 'delete-rate') {
    this.deleteRate();
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

Anime.prototype.saveRateResult = function (rate, fallbackStatus) {
  if (rate) {
    this.anime.rate_id = rate.rate_id || rate.id || this.anime.rate_id || 0;
    this.anime.user_rate_status = rate.user_rate_status || fallbackStatus || this.anime.user_rate_status || '';
    this.anime.user_score = rate.user_score || this.anime.user_score || 0;
    this.anime.user_episodes = rate.user_episodes || this.anime.user_episodes || 0;
  }
};

Anime.prototype.upsertRate = function (status) {
  const self = this;
  const done = function (rate) {
    self.saveRateResult(rate, status);
    if (Lampa.Noty) Lampa.Noty.show('ShikiLamp: статус сохранён — ' + (userApi.RATE_STATUS_TITLES[status] || status));
  };
  const fail = function (err) {
    logger.warn('rate save error', err.message);
    if (Lampa.Noty) Lampa.Noty.show('Ошибка Shikimori: ' + err.message);
  };
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
  userApi.deleteAnimeRate(this.anime.rate_id).then(function () {
    self.anime.rate_id = 0;
    self.anime.user_rate_status = '';
    self.anime.user_score = 0;
    self.anime.user_episodes = 0;
    if (Lampa.Noty) Lampa.Noty.show('Удалено из списка Shikimori');
  }).catch(function (err) {
    if (Lampa.Noty) Lampa.Noty.show('Ошибка Shikimori: ' + err.message);
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
