/**
 * UI helpers for card lists and selection.
 */
const config = require('../config');

function createCard(anime) {
  return {
    source: 'shikimori',
    id: anime.shikimori_id,
    title: anime.title,
    original_title: anime.original_title,
    poster: anime.poster,
    background_image: anime.poster,
    year: anime.year,
    episodes: anime.episodes,
    score: anime.score,
    status: anime.status,
    kind: anime.kind,
    shikimori_id: anime.shikimori_id,
    overview: anime.description,
    genre_ids: []
  };
}

function createLine(title, animes, onSelect) {
  const items = animes.map(function (anime) {
    const card = createCard(anime);
    card.onSelect = onSelect ? function () { onSelect(anime); } : null;
    return card;
  });
  return {
    title: title,
    results: items,
    type: 'shikimori'
  };
}

module.exports = { createCard, createLine };
