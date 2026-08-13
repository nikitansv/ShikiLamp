/**
 * Shared DOM card helper for Shikimori anime lists.
 */
const templates = require('./templates');
const matcher = require('../mapping/matcher');

function createDomCard(anime, options) {
  options = options || {};
  const el = document.createElement('div');
  el.className = 'shikimori-local__result selector';
  if (anime && anime.shikimori_id) {
    el.__shikimoriAnime = anime;
  }

  const score = anime.score && Number(anime.score) > 0 ? anime.score : '';
  const scoreClass = Number(score) < 6 ? ' score-low' : Number(score) < 7.5 ? ' score-mid' : ' score-high';
  const type = typeBadge(anime.kind);

  el.innerHTML = '<div class="shikimori-local__result-poster">' +
      '<img src="' + templates.escapeHtml(anime.poster || '') + '" />' +
      (type ? '<div class="shikimori-local__result-type type-' + type.key + '">' + type.label + '</div>' : '') +
      (score ? '<div class="shikimori-local__result-score' + scoreClass + '">' + templates.escapeHtml(String(score)) + '</div>' : '') +
    '</div>' +
    '<div class="shikimori-local__result-info">' +
      '<div class="shikimori-local__result-title">' + templates.escapeHtml(anime.title) + '</div>' +
    '</div>';

  if (typeof options.onEnter === 'function') {
    el.addEventListener('hover:enter', options.onEnter);
    el.addEventListener('click', options.onEnter);
  }
  if (typeof options.onLongPress === 'function') {
    el.addEventListener('hover:long', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      options.onLongPress();
    });
    el.addEventListener('contextmenu', function (event) {
      event.preventDefault();
      options.onLongPress();
    });
  }

  if (anime && anime.shikimori_id) {
    matcher.applyBestPoster(anime).then(function () {
      const img = el.querySelector('img');
      if (img && anime.poster && document.body.contains(el)) img.src = anime.poster;
    });
  }

  return el;
}

function typeBadge(kind) {
  const types = { tv: ['tv', 'TV'], ova: ['ova', 'OVA'], ona: ['ona', 'ONA'], movie: ['movie', 'Movie'], special: ['special', 'Special'] };
  const value = types[String(kind || '').toLowerCase()];
  return value ? { key: value[0], label: value[1] } : null;
}

module.exports = { createDomCard, typeBadge };
