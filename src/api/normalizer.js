/**
 * Normalize Shikimori GraphQL/REST responses to a stable internal format.
 */
const config = require('../config');

function getPoster(item) {
  if (!item) return '';
  if (item.poster) return item.poster.mainUrl || item.poster.originalUrl || '';
  if (item.image) return 'https://shikimori.io' + (item.image.preview || item.image.x96 || item.image.original || '');
  return '';
}

function getImage(item) {
  return getPoster(item);
}

function getYear(item) {
  const aired = item.airedOn || item.aired_on;
  if (aired) {
    if (aired.year) return aired.year;
    if (typeof aired === 'string') return parseInt(aired.slice(0, 4), 10) || 0;
  }
  const released = item.releasedOn || item.released_on;
  if (released) {
    if (released.year) return released.year;
    if (typeof released === 'string') return parseInt(released.slice(0, 4), 10) || 0;
  }
  return 0;
}

function getStatus(item) {
  return item.status || 'unknown';
}

function getKind(item) {
  return item.kind || 'tv';
}

function getScore(item) {
  const s = parseFloat(item.score);
  return isNaN(s) ? 0 : s;
}

function getEpisodes(item) {
  const e = parseInt(item.episodes, 10);
  return isNaN(e) ? 0 : e;
}

function getDuration(item) {
  const d = parseInt(item.duration, 10);
  return isNaN(d) ? 0 : d;
}

function getMalId(item) {
  return item.malId || item.myanimelist_id || 0;
}

function getTitles(item) {
  const names = [];
  if (item.name) names.push(item.name);
  if (item.english) {
    if (Array.isArray(item.english)) names.push.apply(names, item.english);
    else names.push(item.english);
  }
  if (item.russian) names.push(item.russian);
  if (item.japanese) {
    if (Array.isArray(item.japanese)) names.push.apply(names, item.japanese);
    else names.push(item.japanese);
  }
  if (Array.isArray(item.synonyms)) names.push.apply(names, item.synonyms);
  return names.filter(Boolean);
}

function normalizeAnime(item) {
  if (!item) return null;
  const titles = getTitles(item);
  return {
    source: 'shikimori',
    id: String(item.id),
    shikimori_id: parseInt(item.id, 10),
    mal_id: getMalId(item),
    title: item.russian || item.english || item.name || titles[0] || 'Unknown',
    original_title: item.name || '',
    english_title: Array.isArray(item.english) ? item.english[0] : (item.english || ''),
    russian_title: item.russian || '',
    japanese_title: Array.isArray(item.japanese) ? item.japanese[0] : (item.japanese || ''),
    aliases: titles,
    kind: getKind(item),
    status: getStatus(item),
    year: getYear(item),
    episodes: getEpisodes(item),
    episodes_aired: parseInt(item.episodesAired, 10) || 0,
    duration: getDuration(item),
    score: getScore(item),
    rating: item.rating || '',
    description: item.description || '',
    description_html: item.descriptionHtml || '',
    poster: getPoster(item),
    image: getImage(item),
    url: item.url || '',
    genres: (item.genres || []).map(function (g) { return g.russian || g.name || ''; }).filter(Boolean),
    studios: (item.studios || []).map(function (s) { return s.name || ''; }).filter(Boolean),
    external_links: (item.externalLinks || []).map(function (l) {
      return { kind: l.kind || '', url: l.url || '' };
    })
  };
}

function normalizeList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeAnime).filter(Boolean);
}

function normalizeSearchResponse(data) {
  if (data && Array.isArray(data.animes)) return normalizeList(data.animes);
  if (Array.isArray(data)) return normalizeList(data);
  return [];
}

function normalizeAnimeResponse(data) {
  if (data && Array.isArray(data.animes) && data.animes.length > 0) {
    return normalizeAnime(data.animes[0]);
  }
  if (data && data.id) return normalizeAnime(data);
  return null;
}

module.exports = {
  normalizeAnime,
  normalizeList,
  normalizeSearchResponse,
  normalizeAnimeResponse,
  getYear,
  getKind,
  getMalId,
  getTitles
};
