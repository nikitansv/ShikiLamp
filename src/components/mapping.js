/**
 * Manual mapping component.
 */
const templates = require('../ui/templates');
const matcher = require('../mapping/matcher');
const storage = require('../mapping/storage');
const logger = require('../logger');

function Mapping(params) {
  this.params = params || {};
  this.html = null;
  this.anime = this.params.anime || {};
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
  matcher.searchTmdb(this.anime).then(function (candidates) {
    self.candidates = candidates;
    self.html.innerHTML = templates.mappingTemplate(self.anime, candidates);
    self.bindEvents();
    Lampa.Controller.collectionSet(self.html);
    const first = self.html.querySelector('.shikimori-local__candidate');
    if (first) Lampa.Controller.collectionFocus(first, self.html);
  }).catch(function (err) {
    logger.warn('Mapping load error', err.message);
    self.html.innerHTML = templates.mappingTemplate(self.anime, []);
    self.bindEvents();
  });
};

Mapping.prototype.bindEvents = function () {
  const self = this;
  this.html.querySelectorAll('.shikimori-local__candidate').forEach(function (el) {
    el.addEventListener('hover:enter', function () {
      const id = parseInt(el.getAttribute('data-id'), 10);
      const type = el.getAttribute('data-type');
      const season = parseInt(prompt('Номер сезона', '1') || '1', 10);
      const offset = parseInt(prompt('Смещение эпизодов', '0') || '0', 10);
      self.save(id, type, season, offset);
    });
  });
  const saveBtn = this.html.querySelector('[data-action="manual-save"]');
  if (saveBtn) {
    saveBtn.addEventListener('hover:enter', function () {
      const idInput = self.html.querySelector('.shikimori-local__manual-id');
      const typeInput = self.html.querySelector('.shikimori-local__manual-type');
      const seasonInput = self.html.querySelector('.shikimori-local__manual-season');
      const id = parseInt(idInput.value, 10);
      if (isNaN(id)) return;
      self.save(id, typeInput.value, parseInt(seasonInput.value, 10) || 1, 0);
    });
  }
};

Mapping.prototype.save = function (tmdbId, type, season, offset) {
  const mapping = matcher.saveManual(this.anime, tmdbId, type, season, offset);
  if (Lampa.Noty) Lampa.Noty.show('Mapping сохранён');
  if (matcher.openLampaCard(this.anime, mapping)) {
    Lampa.Activity.backward();
  }
};

Mapping.prototype.render = function () {
  return this.html;
};

Mapping.prototype.destroy = function () {
  this.html = null;
};

module.exports = Mapping;
