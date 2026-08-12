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

  el.innerHTML = '<div class="shikimori-local__result-poster">' +
      '<img src="' + templates.escapeHtml(anime.poster || '') + '" />' +
      (score ? '<div class="shikimori-local__result-score">' + templates.escapeHtml(String(score)) + '</div>' : '') +
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

module.exports = { createDomCard };
