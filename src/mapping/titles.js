/** Search variants only: never change the displayed Shikimori title. */
function clean(title) {
  return String(title || '').replace(/\s+/g, ' ').trim();
}

function baseTitle(title, kind) {
  const original = clean(title);
  if (!/^(tv|tv_series|ona)$/i.test(kind || '')) return original;
  const base = original
    .replace(/\s*[:\-–—]?\s+(?:(?:season|сезон)\s*\d{1,2}|\d{1,2}(?:st|nd|rd|th)?\s*(?:season|сезон)|[2-9]|[1-9]\d|II|III|IV|V|VI|VII|VIII|IX|X)\s*$/i, '')
    .trim();
  return /[a-z\u0400-\u04ff\u3040-\u9fff]/i.test(base) ? base : original;
}

function queries(anime) {
  const names = [anime.russian_title, anime.title, anime.original_title, anime.english_title, anime.japanese_title]
    .concat(anime.aliases || []);
  const out = [];
  const seen = Object.create(null);
  names.forEach(function (name) {
    [baseTitle(name, anime.kind), clean(name)].forEach(function (value) {
      const key = value.toLowerCase();
      if (value && !seen[key] && out.length < 8) {
        seen[key] = true;
        out.push(value);
      }
    });
  });
  return out;
}

module.exports = { baseTitle, queries };
