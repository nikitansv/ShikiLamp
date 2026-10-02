/**
 * CSS styles for Shikimori Local plugin screens.
 */
function injectStyles() {
  if (document.getElementById('shikimori-local-styles')) return;
  const style = document.createElement('style');
  style.id = 'shikimori-local-styles';
  style.textContent = `
    :root { --shiki-card-scale: 1; --shiki-card-size: 1; --shiki-font-scale: 1; --shiki-heading-scale: 1; --shiki-motion: 180ms; --shiki-focus-color: #ffffff; --shiki-accent: #8ab4ff; --shiki-card-radius: 10px; --shiki-card-bg: rgba(255,255,255,0.08); --shiki-rating-bg: rgba(0,0,0,0.72); --shiki-rating-low: #ff6b6b; --shiki-rating-mid: #e5e7eb; --shiki-rating-high: #ffd54a; --shiki-type-tv: #5aa9ff; --shiki-type-ova: #bd8cff; --shiki-type-ona: #42c99a; --shiki-type-movie: #ff9b54; --shiki-type-special: #e5c255; --shiki-group-ongoing: #42c99a; --shiki-group-released: #8ab4ff; --shiki-group-anons: #bd8cff; --shiki-group-planned: #e5c255; --shiki-group-watching: #ff8aa1; }
    .shikimori-local.activity-page { padding: 0; max-height: none; overflow: visible; font-size: inherit; }
    .shikimori-local { --shiki-gutter: 1.5em; --shiki-gap: 1.5em; --shiki-panel-width: 22em; padding: 1.5em var(--shiki-gutter) 3em; color: inherit; max-height: 100vh; overflow-y: auto; box-sizing: border-box; font-size: calc(1em * var(--shiki-font-scale)); line-height: 1.4; }
    .shikimori-local *, .shikilamp-auth * { box-sizing: border-box; }
    .shiki-page-enter { animation: shiki-page-in var(--shiki-motion) ease-out; }
    @keyframes shiki-page-in { from { opacity: 0; } to { opacity: 1; } }
    .shikimori-local__action, .shikimori-local__dropdown-item, .shikimori-local__filter-field, .shikimori-local__filter-option, .shikimori-local__filter-start, .shikimori-local__filter-reset, .shikilamp-auth button { transition: background-color var(--shiki-motion) ease-out, color var(--shiki-motion) ease-out; }
    .shikimori-local.home-page, .shikimori-local.userlists-page { padding-left: var(--shiki-gutter); padding-right: var(--shiki-gutter); }

    .home-page > .shikimori-local__head, .home-page > .shikimori-local__tabs, .home-page > .shikimori-local__section,
    .userlists-page > .shikimori-local__head, .userlists-page > .shikimori-local__tabs,
    .home-page .shikimori-local__row-title, .userlists-page .shikimori-local__row-title { margin-left: 0; margin-right: 0; }
    .shikimori-local__tabs { display: flex; gap: 0.75em; flex-wrap: wrap; margin-bottom: 1.5em; }
    .shikimori-local__tab { display: flex; align-items: center; min-height: 2.8em; padding: 0.3em 1.2em; border-radius: 1em; background: var(--shiki-card-bg); color: inherit; cursor: pointer; transition: background var(--shiki-motion), box-shadow var(--shiki-motion); }
    .shikimori-local__tab.active { box-shadow: inset 0 0 0 0.12em currentColor; }
    .shikimori-local__tab.focus { background: rgba(255,255,255,0.9); color: #111; }
    .shikimori-local__head { font-size: calc(1.5em * var(--shiki-heading-scale)); line-height: 1.3; margin-bottom: 1.5em; font-weight: 600; }
    .shikimori-local__home-rows { display: flex; flex-direction: column; gap: var(--shiki-gap); }
    .shikimori-local__row-title { font-size: calc(1.3em * var(--shiki-heading-scale)); margin-bottom: 0.5em; font-weight: 600; }
    .shikimori-local__row { min-width: 0; }

    .shikimori-local__row-items { display: flex; flex-wrap: nowrap; align-items: flex-start; gap: var(--shiki-gap); overflow-x: auto; overflow-y: hidden; scroll-behavior: smooth; scroll-padding: var(--shiki-gutter); padding: 1.25em var(--shiki-gutter); margin: 0 calc(-1 * var(--shiki-gutter)); scrollbar-width: none; }
    .shikimori-local__row-items::-webkit-scrollbar { display: none; }
    .shikimori-local__row-items .shikimori-local__result,
    .shikimori-local__row-items .shikimori-local__more { flex: 0 0 calc(12.75em * var(--shiki-card-size)); min-width: 0; }
    .shikimori-local__sections { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1em; }
    .shikimori-local__section { padding: 1em; background: rgba(255,255,255,0.08); border-radius: 0.5em; cursor: pointer; transition: background var(--shiki-motion); }
    .shikimori-local__section.focus, .shikimori-local__section:hover { background: rgba(255,255,255,0.18); }
    .shikimori-local__results { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(12.75em * var(--shiki-card-size))), 1fr)); gap: var(--shiki-gap); padding: 0.75em 0; }
    .shikimori-local.userlists-page.grouped .shikimori-local__results { display: flex; flex-direction: column; gap: var(--shiki-gap); padding: 0; }

    .shikimori-local__result { position: relative; cursor: pointer; border-radius: var(--shiki-card-radius); transition: transform var(--shiki-motion), box-shadow var(--shiki-motion), opacity var(--shiki-motion); transform-origin: center center; }
    .shikimori-local__result-poster { position: relative; aspect-ratio: 2 / 3; overflow: hidden; border-radius: var(--shiki-card-radius); background: var(--shiki-card-bg); }
    .shikimori-local__result-poster img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--shiki-card-radius); display: block; }
    .shikimori-local__result-score { position: absolute; top: 0.4em; right: 0.4em; background: var(--shiki-rating-bg); font-weight: 700; font-size: 0.9em; padding: 0.15em 0.45em; border-radius: 0.3em; }
    .shikimori-local__result-type { position: absolute; top: 0.4em; left: 0.4em; padding: 0.15em 0.45em; border-radius: 0.3em; color: #fff; background: rgba(0,0,0,0.72); font-size: 0.78em; font-weight: 700; }
    .shikimori-local__result-type.type-tv { color: var(--shiki-type-tv); }
    .shikimori-local__result-type.type-ova { color: var(--shiki-type-ova); }
    .shikimori-local__result-type.type-ona { color: var(--shiki-type-ona); }
    .shikimori-local__result-type.type-movie { color: var(--shiki-type-movie); }
    .shikimori-local__result-type.type-special { color: var(--shiki-type-special); }
    .shikimori-local__result-score.score-low { color: var(--shiki-rating-low); }
    .shikimori-local__result-score.score-mid { color: var(--shiki-rating-mid); }
    .shikimori-local__result-score.score-high { color: var(--shiki-rating-high); }
    .shikimori-local__result.focus, .shikimori-local__result:hover { transform: scale(var(--shiki-card-scale)); box-shadow: none; z-index: 2; }
    .shikimori-local__row-items .shikimori-local__result:first-child { transform-origin: left center; }
    .shikimori-local__row-items .shikimori-local__result:last-child { transform-origin: right center; }
    .shikimori-local__result-title { display: -webkit-box; margin-top: 0.65em; overflow: hidden; font-size: 1.1em; font-weight: 500; line-height: 1.3; text-overflow: ellipsis; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .shikimori-local__result.focus .shikimori-local__result-poster { outline: 0.2em solid var(--shiki-focus-color); outline-offset: 0.25em; }
    .shikimori-local__result-meta { font-size: 0.85em; opacity: 0.75; }
    .shikimori-local.anime-detail { display: flex; gap: 2.8em; align-items: flex-start; min-height: calc(100vh - 6.5em); padding: 2.6em 3.2em; border-radius: 20px; }
    .shikimori-local__poster { width: 360px; aspect-ratio: 2 / 3; flex: 0 0 360px; border-radius: 16px; background: rgba(255,255,255,0.08); overflow: hidden; align-self: flex-start; margin-top: 0.12em; }
    .shikimori-local__poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .shikimori-local__poster-fallback { height: 100%; display: flex; align-items: center; justify-content: center; padding: 1em; text-align: center; color: rgba(255,255,255,0.72); }
    .shikimori-local__info { min-width: 0; flex: 1; max-width: 1120px; padding-top: 0; }
    .shikimori-local__info h1 { font-size: 2.65em; font-weight: 700; line-height: 1.13; margin: 0 0 0.22em; white-space: normal; overflow-wrap: anywhere; }
    .shikimori-local__sub { font-size: 1.05em; color: rgba(255,255,255,0.68); margin-top: 0.35em; }
    .shikimori-local__meta { display: flex; flex-wrap: wrap; gap: 0.45em 0.75em; margin: 1em 0; color: rgba(255,255,255,0.76); }
    .shikimori-local__meta span { white-space: nowrap; }
    .shikimori-local__meta span:not(:last-child)::after { content: '•'; margin-left: 0.75em; opacity: 0.55; }
    .shikimori-local__studios { margin: 0.55em 0 0.8em; color: rgba(255,255,255,0.76); }
    .shikimori-local__studio { display: inline-block; margin: 0 0.25em; color: var(--shiki-accent); text-decoration: underline; }
    .shikimori-local__description { max-width: 100%; font-size: 1em; line-height: 1.58; color: rgba(255,255,255,0.82); margin: 1.2em 0 0.55em; overflow-wrap: anywhere; }
    .shikimori-local__description.collapsed { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .shikimori-local__description.expanded { display: block; }
    .shikimori-local__text-toggle { display: inline-block; color: rgba(255,255,255,0.86); padding: 0.35em 0; margin-bottom: 1.1em; }
    .shikimori-local__primary-actions, .shikimori-local__service-actions { display: flex; gap: 0.65em; flex-wrap: wrap; align-items: center; margin-top: 1em; }
    .shikimori-local__service-actions { margin-top: 0.75em; padding-top: 0.75em; border-top: 1px solid rgba(255,255,255,0.08); }
    .shikimori-local__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75em; margin: 1.5em 0; }
    .shikimori-local__action { min-height: 2.8em; max-width: 100%; padding: 0.5em 1.2em; display: inline-flex; align-items: center; justify-content: center; background: var(--shiki-card-bg); border-radius: 1em; cursor: pointer; text-align: center; overflow-wrap: anywhere; }
    .shikimori-local__action.primary { background: rgba(255,255,255,0.88); color: #111; font-weight: 650; }
    .shikimori-local__action.secondary { background: rgba(255,255,255,0.14); }
    .shikimori-local__action.tertiary { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.82); }
    .shikimori-local__action.focus, .shikimori-local__dropdown-item.focus, .shikimori-local__text-toggle.focus { background: #fff; color: #111; outline: 0.12em solid #fff; outline-offset: 0.15em; }
    .shikimori-local__action.disabled, .shikimori-local__dropdown-item.disabled { opacity: 0.55; pointer-events: none; }
    .shikimori-local__action.loading::after { content: ' · Сохранение…'; }
    .shikimori-local__dropdown { display: none; max-width: 520px; margin: 0.55em 0 0.9em; padding: 0.45em; border-radius: 14px; background: rgba(24,24,28,0.98); border: 1px solid rgba(255,255,255,0.12); }
    .shikimori-local__dropdown.open { display: grid; gap: 0.35em; }
    .shikimori-local__dropdown.score-grid { grid-template-columns: repeat(5, minmax(44px, 1fr)); max-width: 320px; }
    .shikimori-local__dropdown.score-grid .score { text-align: center; justify-content: center; font-size: 1.05em; }
    .shikimori-local__dropdown.score-grid .score-separator, .shikimori-local__dropdown.score-grid .destructive { grid-column: 1 / -1; }
    .shikimori-local__dropdown-item { padding: 0.72em 0.8em; border-radius: 10px; background: rgba(255,255,255,0.05); }
    .shikimori-local__dropdown-item.active { background: rgba(255,255,255,0.18); }
    .shikimori-local__dropdown-item.destructive { color: #ff8d8d; }
    .shikimori-local__dropdown-separator { height: 1px; background: rgba(255,255,255,0.12); margin: 0.25em 0; }
    @media (max-width: 1024px) { .shikimori-local__poster { width: 260px; flex-basis: 260px; } .shikimori-local__info h1 { font-size: 2.15em; } .shikimori-local.anime-detail { padding: 2em; gap: 2em; } }
    @media (max-width: 600px) { .shikimori-local.anime-detail { flex-direction: column; padding: 1em; } .shikimori-local__poster { width: 170px; flex-basis: auto; align-self: center; } .shikimori-local__action { width: 100%; } }
    .shikimori-local__input { width: 100%; padding: 0.8em; font-size: 1em; background: rgba(255,255,255,0.08); border: none; color: #fff; border-radius: 0.4em; margin-bottom: 1em; }
    .shikimori-local.filter-page { display: flex; gap: 0; min-height: 100vh; padding: 0; overflow: hidden; }
    .shikimori-filter-activity { position: fixed; z-index: 2147483000; inset: 0; pointer-events: none; }
    .shikimori-filter-activity .filter-page { pointer-events: auto; background: transparent; }
    .shikimori-filter-activity.menu-open { z-index: 1; }
    .shikimori-filter-activity.menu-open .filter-page { pointer-events: none; }
    .shikimori-filter-activity.host-open { z-index: 1; }
    .shikimori-filter-activity.host-open .filter-page { pointer-events: none; }
    .shikimori-filter-activity .shikimori-local__filter-main { transition: transform var(--shiki-motion) ease-out, padding-right var(--shiki-motion) ease-out; }
    .shikimori-filter-activity.menu-open .shikimori-local__filter-main { transform: translateX(var(--shiki-menu-shift, 340px)); }
    .shikimori-filter-activity.menu-open .shikimori-local__filter-panel { transform: translateX(100%); }
    .shikimori-filter-activity.panel-hidden .shikimori-local__filter-panel { transform: translateX(100%); pointer-events: none; }
    .shikimori-filter-activity.panel-hidden .shikimori-local__filter-main { padding-right: var(--shiki-gutter); }
    .shikimori-local__filter-main { flex: 1; min-width: 0; height: 100vh; padding: 7em calc(var(--shiki-panel-width) + var(--shiki-gutter)) 3em var(--shiki-gutter); overflow-y: auto; }

    .shikimori-local__filter-panel { position: fixed; z-index: 2147483001; top: 0; right: 0; bottom: 0; width: var(--shiki-panel-width); height: 100vh; padding: 1.5em; background: #242627; overflow-y: auto; transition: transform var(--shiki-motion) ease-out; animation: shiki-filter-in var(--shiki-motion) ease-out; }
    @keyframes shiki-filter-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .shikimori-local__filter-title { font-size: 1.5em; font-weight: 600; margin-bottom: 1em; }
    .shikimori-local__filter-start, .shikimori-local__filter-reset { padding: 0.75em 1em; margin-bottom: 1em; border-radius: 0.5em; background: var(--shiki-card-bg); }
    .shikimori-local__filter-fields { display: grid; gap: 0.5em; margin-bottom: 1em; }
    .shikimori-local__filter-field { display: block; width: 100%; padding: 0.75em 1em; border-radius: 0.5em; background: transparent; text-align: left; }
    .shikimori-local__filter-value { display: block; color: rgba(255,255,255,0.62); margin: 0.45em 0 0; font-size: 0.9em; }
    .shikimori-local__filter-field.focus, .shikimori-local__filter-start.focus, .shikimori-local__filter-reset.focus { background: #fff; color: #111; }
    .shikimori-local__filter-field.focus .shikimori-local__filter-value { color: #555; }
    .shikimori-local__filter-options { display: grid; gap: 0.5em; }
    .shikimori-local__filter-option { padding: 0.75em 0.6em; border-radius: 0.35em; background: rgba(255,255,255,0.06); }
    .shikimori-local__filter-option.active { background: rgba(255,255,255,0.16); }
    .shikimori-local__filter-option.focus { background: rgba(255,255,255,0.9); color: #111; }
    @media (max-width: 900px) { .shikimori-local { --shiki-panel-width: 40vw; } }
    @media (max-width: 600px) { .shikimori-local { --shiki-gutter: 1em; --shiki-gap: 1em; --shiki-panel-width: 90vw; } .shikimori-local__filter-main { padding-right: var(--shiki-gutter); } .shikimori-local__manual label { flex-wrap: wrap; } }
    .shikimori-local__loading, .shikimori-local__empty, .shikimori-local__error, .shikimori-local__query { padding: 1em 0; opacity: 0.8; grid-column: 1 / -1; }
    .shikimori-local__more { display: flex; align-items: center; justify-content: center; align-self: start; aspect-ratio: 2 / 3; padding: 1em; box-sizing: border-box; background: var(--shiki-card-bg); border-radius: var(--shiki-card-radius); cursor: pointer; text-align: center; font-size: 1em; transition: transform var(--shiki-motion), background var(--shiki-motion); }
    .shikimori-local__more.focus { background: #fff; color: #111; outline: 0.2em solid var(--shiki-focus-color); outline-offset: 0.25em; }
    .shikimori-local__candidate { display: flex; gap: 1em; padding: 0.8em; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .shikimori-local__candidate.focus { background: rgba(255,255,255,0.12); }
    .shikimori-local__candidate img { width: 92px; border-radius: 0.3em; }
    .shikimori-local__manual { margin-top: 1em; display: flex; flex-direction: column; gap: 0.6em; }
    .shikimori-local__manual label { display: flex; align-items: center; gap: 0.5em; }
    .shikimori-local__manual input, .shikimori-local__manual select { min-width: 0; max-width: 100%; padding: 0.75em; font: inherit; background: #303234; border: none; color: #fff; border-radius: 0.5em; }
    .shikimori-local__manual .selector.focus { outline: 0.15em solid #fff; outline-offset: 0.15em; }
    .shikimori-local__mapping { padding: 1em; border-radius: 0.75em; background: var(--shiki-card-bg); }
    .shikimori-local__mapping-title { font-size: 1.2em; margin-bottom: 0.5em; }
    .shikimori-local__mapping-meta { opacity: 0.75; margin-bottom: 1em; overflow-wrap: anywhere; }
    .shikimori-local__mapping.focus, .shikimori-local__candidate.focus { outline: 0.15em solid #fff; outline-offset: 0.15em; }
    .shikimori-local__candidate-info { min-width: 0; overflow-wrap: anywhere; }
    .shikimori-local__diag { display: grid; gap: 0.5em; margin-bottom: 1em; }
    .shikimori-local__diag div { padding: 0.4em; background: rgba(255,255,255,0.05); border-radius: 0.3em; }
    .shikilamp-auth { position: fixed; inset: 0; z-index: 9999999; display: flex; align-items: center; justify-content: center; padding: 2em; box-sizing: border-box; background: rgba(8,8,12,0.94); color: #fff; }
    .shikilamp-auth__panel { width: min(920px, 92vw); max-height: 90vh; padding: 1.5em; overflow-y: auto; border-radius: 1em; background: #242627; text-align: center; }
    .shikilamp-auth__title { font-size: 2em; font-weight: 700; margin-bottom: 0.5em; }
    .shikilamp-auth__hint { font-size: 1.15em; line-height: 1.4; opacity: 0.82; max-width: 760px; margin: 0 auto 1em; }
    .shikilamp-auth__qr { display: block; width: min(340px, 42vh); max-width: 100%; height: auto; margin: 0.8em auto; background: #fff; border-radius: 12px; image-rendering: pixelated; }
    .shikilamp-auth__url { max-width: 880px; margin: 0.8em auto; font-size: 0.8em; line-height: 1.35; opacity: 0.65; word-break: break-all; }
    .shikilamp-auth__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.75em; margin-top: 1.5em; }
    .shikilamp-auth button { min-height: 2.8em; padding: 0.5em 1.2em; border: 0; border-radius: 1em; font: inherit; background: rgba(255,255,255,0.1); color: #fff; }
    .shikilamp-auth button.focus { background: #fff; color: #111; }
    .shikilamp-auth button:focus, .shikilamp-auth button.focus { outline: 3px solid #fff; outline-offset: 3px; }
    [data-shiki-motion="off"] .shikimori-local__row-items { scroll-behavior: auto; }
    @media (prefers-reduced-motion: reduce) {
      .shikimori-local, .shikimori-local *, .shikilamp-auth, .shikilamp-auth * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    }
  `;
  document.head.appendChild(style);
}

function applyUiSettings(ui) {
  if (typeof document === 'undefined') return;
  ui = ui || {};
  const root = document.documentElement;
  root.setAttribute('data-shiki-motion', ui.motion || 'normal');
  const values = {
    '--shiki-card-scale': clamp(ui.cardScale, 100, 115, 100) / 100,
    '--shiki-card-size': clamp(ui.cardSize, 60, 180, 100) / 100,
    '--shiki-font-scale': clamp(ui.fontScale, 70, 180, 100) / 100,
    '--shiki-heading-scale': clamp(ui.headingScale, 70, 180, 100) / 100,
    '--shiki-motion': motion(ui.motion),
    '--shiki-card-radius': clamp(ui.radius, 0, 24, 10) + 'px'
  };
  const colors = ['focusColor', 'accentColor', 'cardColor', 'ratingBackground', 'ratingLow', 'ratingMid', 'ratingHigh', 'typeTv', 'typeOva', 'typeOna', 'typeMovie', 'typeSpecial', 'groupOngoing', 'groupReleased', 'groupAnons', 'groupPlanned', 'groupWatching'];
  const names = ['--shiki-focus-color', '--shiki-accent', '--shiki-card-bg', '--shiki-rating-bg', '--shiki-rating-low', '--shiki-rating-mid', '--shiki-rating-high', '--shiki-type-tv', '--shiki-type-ova', '--shiki-type-ona', '--shiki-type-movie', '--shiki-type-special', '--shiki-group-ongoing', '--shiki-group-released', '--shiki-group-anons', '--shiki-group-planned', '--shiki-group-watching'];
  Object.keys(values).forEach(function (name) { root.style.setProperty(name, values[name]); });
  colors.forEach(function (key, index) { if (ui[key]) root.style.setProperty(names[index], ui[key]); });
}

function clamp(value, min, max, fallback) {
  const n = parseFloat(value);
  return isNaN(n) ? fallback : Math.min(Math.max(n, min), max);
}

function motion(value) {
  return value === 'off' ? '0ms' : value === 'soft' ? '320ms' : value === 'fast' ? '90ms' : '180ms';
}

module.exports = { injectStyles, applyUiSettings };
