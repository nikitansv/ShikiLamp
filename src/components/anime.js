/**
 * Anime detail component.
 */
const templates = require('../ui/templates');
const matcher = require('../mapping/matcher');
const storage = require('../mapping/storage');
const logger = require('../logger');

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
