/**
 * Shared DOM card helper for Shikimori anime lists.
 */
const templates = require('./templates');
const matcher = require('../mapping/matcher');
const lifecycle = require('../components/lifecycle');

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
      '<img />' +
      (type ? '<div class="shikimori-local__result-type type-' + type.key + '">' + type.label + '</div>' : '') +
      (score ? '<div class="shikimori-local__result-score' + scoreClass + '">' + templates.escapeHtml(String(score)) + '</div>' : '') +
    '</div>' +
    '<div class="shikimori-local__result-info">' +
      '<div class="shikimori-local__result-title">' + templates.escapeHtml(anime.title) + '</div>' +
    '</div>';

  loadPoster(el.querySelector('img'), anime);

  if (typeof options.onEnter === 'function') {
    lifecycle.bindAction(el, options.onEnter);
  }
  if (typeof options.onLongPress === 'function') {
    el.addEventListener('hover:long', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      options.onLongPress();
    });
    el.addEventListener('contextmenu', function (event) {
      event.preventDefault();
      if (!el.bind_events) options.onLongPress();
    });
  }

  if (anime && anime.shikimori_id) {
    matcher.applyBestPoster(anime).then(function () {
      const img = el.querySelector('img');
      if (img && document.body.contains(el)) loadPoster(img, anime);
    });
  }

  return el;
}

function loadPoster(image, anime) {
  if (!image) return;
  let state = image.__shikimoriPoster;
  if (!state) {
    state = image.__shikimoriPoster = { failed: [], sources: [] };
    const placeholder = document.createElement('div');
    placeholder.className = 'shikimori-local__poster-fallback';
    placeholder.textContent = anime.title || 'Нет постера';
    image.parentNode.appendChild(placeholder);
    image.alt = anime.title || '';
    image.referrerPolicy = 'no-referrer';
    state.show = function () {
      const next = state.sources.find(function (url) { return state.failed.indexOf(url) < 0; });
      image.style.display = next ? '' : 'none';
      placeholder.style.display = next ? 'none' : '';
      if (next && image.getAttribute('src') !== next) image.src = next;
      if (!next) image.removeAttribute('src');
    };
    image.onerror = function () {
      state.failed.push(image.getAttribute('src'));
      state.show();
    };
  }
  state.sources = [anime.poster, anime.image].concat(anime.poster_fallbacks || [], state.sources)
    .filter(function (url, index, list) { return typeof url === 'string' && url && list.indexOf(url) === index; });
  state.show();
}

function typeBadge(kind) {
  const types = { tv: ['tv', 'TV'], ova: ['ova', 'OVA'], ona: ['ona', 'ONA'], movie: ['movie', 'Movie'], special: ['special', 'Special'] };
  const value = types[String(kind || '').toLowerCase()];
  return value ? { key: value[0], label: value[1] } : null;
}

module.exports = { createDomCard, typeBadge, loadPoster };
