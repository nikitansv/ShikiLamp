/**
 * Manual mapping component.
 */
const templates = require('../ui/templates');
const matcher = require('../mapping/matcher');
const storage = require('../mapping/storage');
const logger = require('../logger');
const lifecycle = require('./lifecycle');

function Mapping(params) {
  this.params = params || {};
  this.html = null;
  this.anime = this.params.anime || {};
  this.searchQuery = this.anime.title || this.anime.original_title || '';
  this.candidates = [];
}

Mapping.prototype.create = function () {
  this.html = document.createElement('div');
  this.html.className = 'shikimori-local activity-page';
  this.html.innerHTML = templates.mappingTemplate(this.anime, []);
  this.loadCandidates();
};

Mapping.prototype.loadCandidates = function () {
  const self = this;
  this.html.innerHTML = templates.mappingTemplate(this.anime, []);
  this.bindEvents();
  const queryAnime = Object.assign({}, this.anime, {
    title: this.searchQuery,
    russian_title: this.searchQuery,
    original_title: this.searchQuery,
    english_title: '',
    japanese_title: '',
    aliases: []
  });
  matcher.searchTmdb(queryAnime).then(function (candidates) {
    if (self.__shikimoriDestroyed || !self.html) return;
    self.candidates = candidates;
    self.html.innerHTML = templates.mappingTemplate(self.anime, candidates);
    self.bindEvents();
    lifecycle.refocus(self);
  }).catch(function (err) {
    if (self.__shikimoriDestroyed || !self.html) return;
    logger.warn('Mapping load error', err.message);
    self.html.innerHTML = templates.mappingTemplate(self.anime, []);
    self.bindEvents();
  });
};

Mapping.prototype.bindEvents = function () {
  const self = this;
  this.html.querySelectorAll('.shikimori-local__candidate').forEach(function (el) {
    lifecycle.bindAction(el, function () {
      const index = parseInt(el.getAttribute('data-index'), 10);
      const candidate = self.candidates[index];
      const id = parseInt(el.getAttribute('data-id'), 10);
      const type = el.getAttribute('data-type');
      const season = parseInt(prompt('Номер сезона', '1') || '1', 10);
      const offset = parseInt(prompt('Смещение эпизодов', '0') || '0', 10);
      self.save(id, type, season, offset, candidate);
    });
  });
  const queryBtn = this.html.querySelector('[data-action="change-query"]');
  if (queryBtn) {
    lifecycle.bindAction(queryBtn, function () { self.changeQuery(); });
  }
  const saveBtn = this.html.querySelector('[data-action="manual-save"]');
  if (saveBtn) {
    lifecycle.bindAction(saveBtn, function () {
      const idInput = self.html.querySelector('.shikimori-local__manual-id');
      const typeInput = self.html.querySelector('.shikimori-local__manual-type');
      const seasonInput = self.html.querySelector('.shikimori-local__manual-season');
      const id = parseInt(idInput.value, 10);
      if (isNaN(id)) return;
      self.save(id, typeInput.value, parseInt(seasonInput.value, 10) || 1, 0);
    });
  }
};

Mapping.prototype.changeQuery = function () {
  const self = this;
  const save = function (value) {
    value = String(value || '').trim();
    if (!value) return;
    self.searchQuery = value;
    self.loadCandidates();
  };
  if (Lampa.Input && Lampa.Input.edit) {
    Lampa.Input.edit({ title: 'Запрос TMDB', value: this.searchQuery, free: true }, save);
    return;
  }
  save(prompt('Запрос TMDB', this.searchQuery));
};

Mapping.prototype.save = function (tmdbId, type, season, offset, candidate) {
  const poster = candidate && candidate.item && candidate.item.poster_path ? matcher.tmdbPosterUrl(candidate.item.poster_path) : '';
  const mapping = matcher.saveManual(this.anime, tmdbId, type, season, offset, { poster: poster });
  if (Lampa.Noty) Lampa.Noty.show('Mapping сохранён');
  matcher.openLampaCard(this.anime, mapping);
};

Mapping.prototype.render = function () {
  return this.html;
};

Mapping.prototype.destroy = function () {
  this.html = null;
};

module.exports = Mapping;
