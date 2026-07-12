/**
 * Title similarity and mapping confidence scoring.
 */
function normalize(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ').trim();
}

function tokenSet(str) {
  const norm = normalize(str);
  if (!norm) return [];
  return norm.split(/\s+/).filter(function (t) { return t.length > 1; });
}

function jaccard(a, b) {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (!ta.length || !tb.length) return 0;
  const intersection = ta.filter(function (t) { return tb.indexOf(t) >= 0; });
  const union = ta.concat(tb.filter(function (t) { return ta.indexOf(t) < 0; }));
  return union.length ? intersection.length / union.length : 0;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length) || 1;
  return Math.max(0, 1 - dist / maxLen);
}

function bestTitleScore(anime, candidate) {
  const names = [anime.title, anime.original_title, anime.english_title, anime.russian_title, anime.japanese_title]
    .concat(anime.aliases || [])
    .filter(Boolean);
  const candNames = [candidate.name, candidate.original_name, candidate.title, candidate.russian_title]
    .concat(candidate.aliases || [])
    .filter(Boolean);
  let best = 0;
  for (let i = 0; i < names.length; i++) {
    for (let j = 0; j < candNames.length; j++) {
      const sim = similarity(names[i], candNames[j]);
      if (sim > best) best = sim;
    }
  }
  return best;
}

function score(anime, candidate) {
  const titleScore = bestTitleScore(anime, candidate);
  const jaccardScore = jaccard(anime.title + ' ' + anime.original_title, candidate.name + ' ' + candidate.original_name);
  const yearMatch = anime.year && candidate.year ? (anime.year === candidate.year ? 1 : 0.3) : 0.5;
  const typeMatch = kindMatches(anime.kind, candidate.media_type || candidate.type) ? 1 : 0.5;
  const episodesMatch = episodeScore(anime.episodes, candidate.episodes || candidate.episode_count);
  const raw = (titleScore * 0.45 + jaccardScore * 0.25 + yearMatch * 0.15 + typeMatch * 0.05 + episodesMatch * 0.10);
  return Math.round(raw * 100) / 100;
}

function kindMatches(kind, mediaType) {
  const k = String(kind || '').toLowerCase();
  const m = String(mediaType || '').toLowerCase();
  if (k === 'movie' || k === 'film') return m === 'movie' || m === 'film';
  if (k === 'tv' || k === 'tv_series') return m === 'tv' || m === 'tv_series';
  if (k === 'ova' || k === 'ona' || k === 'special') return true;
  if (!m) return true;
  return k === m;
}

function episodeScore(a, b) {
  const ea = parseInt(a, 10);
  const eb = parseInt(b, 10);
  if (isNaN(ea) || isNaN(eb)) return 0.5;
  if (ea === eb) return 1;
  const max = Math.max(ea, eb);
  return max > 0 ? 1 - Math.abs(ea - eb) / max : 0.5;
}

function confidenceLevel(confidence) {
  if (confidence >= 1.0) return 'manual';
  if (confidence >= 0.90) return 'high';
  if (confidence >= 0.80) return 'good';
  if (confidence >= 0.70) return 'medium';
  return 'low';
}

module.exports = {
  normalize,
  similarity,
  jaccard,
  score,
  confidenceLevel,
  kindMatches,
  episodeScore
};
