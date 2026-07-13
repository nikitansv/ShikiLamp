/**
 * CSS styles for Shikimori Local plugin screens.
 */
function injectStyles() {
  if (document.getElementById('shikimori-local-styles')) return;
  const style = document.createElement('style');
  style.id = 'shikimori-local-styles';
  style.textContent = `
    .shikimori-local { padding: 1.5em; color: #fff; max-height: 100vh; overflow-y: auto; box-sizing: border-box; }
    .shikimori-local.home-page { padding-bottom: 6em; transition: transform 0.14s ease, padding-right 0.14s ease; }
    .shikimori-local.home-page.side-open, .shikimori-local.userlists-page.side-open { transform: translateX(-2.2em); padding-right: 0; }
    .shikimori-local.userlists-page { transition: transform 0.14s ease, padding-right 0.14s ease; }
    .shikimori-local__side-panel { position: fixed; top: 5.5em; right: 0.8em; width: 14.5em; height: auto; min-height: 7.5em; padding: 0.65em; box-sizing: border-box; border-radius: 0.8em; background: linear-gradient(180deg, rgba(38,38,42,0.95), rgba(18,18,22,0.95)); border: 1px solid rgba(255,255,255,0.12); opacity: 0.85; transform: translateX(13.8em); pointer-events: none; transition: opacity 0.12s ease, transform 0.12s ease, background 0.12s ease; }
    .shikimori-local__side-panel.visible { opacity: 1; transform: translateX(0); }
    .shikimori-local__side-title { font-size: 0.9em; opacity: 0.78; margin: 0.2em 0.2em 0.7em; line-height: 1.25; max-height: 2.5em; overflow: hidden; }
    .shikimori-local__side-item { padding: 0.95em 1em; margin-bottom: 0.45em; border-radius: 0.65em; background: rgba(255,255,255,0.04); color: #fff; font-size: 1.05em; }
    .shikimori-local__side-item.focus { background: linear-gradient(90deg, rgba(255,255,255,0.92), rgba(180,180,190,0.78)); color: #111; }
    .shikimori-local__tabs { display: flex; gap: 0.7em; flex-wrap: wrap; margin-bottom: 1.2em; }
    .shikimori-local__tab { padding: 0.75em 1em; border-radius: 0.6em; background: rgba(255,255,255,0.08); color: #fff; }
    .shikimori-local__tab.active { border: 1px solid rgba(255,255,255,0.35); }
    .shikimori-local__tab.focus { background: rgba(255,255,255,0.9); color: #111; }
    .shikimori-local__head { font-size: 1.5em; margin-bottom: 1em; font-weight: 600; }
    .shikimori-local__home-rows { display: flex; flex-direction: column; gap: 1.6em; }
    .shikimori-local__row-title { font-size: 1.25em; margin-bottom: 0.7em; font-weight: 600; }
    .shikimori-local__row-items { display: grid; grid-template-columns: repeat(9, minmax(120px, 1fr)); gap: 1em; }
    .shikimori-local__sections { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1em; }
    .shikimori-local__section { padding: 1em; background: rgba(255,255,255,0.08); border-radius: 0.5em; cursor: pointer; transition: background 0.15s; }
    .shikimori-local__section.focus, .shikimori-local__section:hover { background: rgba(255,255,255,0.18); }
    .shikimori-local__results { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1em; }
    .shikimori-local__result { cursor: pointer; }
    .shikimori-local__result img { width: 100%; border-radius: 0.4em; }
    .shikimori-local__result.focus { outline: 2px solid #fff; }
    .shikimori-local__result-title { font-weight: 600; margin-top: 0.4em; }
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
    .shikimori-local__description { max-width: 100%; font-size: 1em; line-height: 1.58; color: rgba(255,255,255,0.82); margin: 1.2em 0 0.55em; overflow-wrap: anywhere; }
    .shikimori-local__description.collapsed { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .shikimori-local__description.expanded { display: block; }
    .shikimori-local__text-toggle { display: inline-block; color: rgba(255,255,255,0.86); padding: 0.35em 0; margin-bottom: 1.1em; }
    .shikimori-local__primary-actions, .shikimori-local__service-actions { display: flex; gap: 0.65em; flex-wrap: wrap; align-items: center; margin-top: 1em; }
    .shikimori-local__service-actions { margin-top: 0.75em; padding-top: 0.75em; border-top: 1px solid rgba(255,255,255,0.08); }
    .shikimori-local__action { min-height: 46px; padding: 0 1em; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.10); border-radius: 12px; cursor: pointer; box-sizing: border-box; }
    .shikimori-local__action.primary { background: rgba(255,255,255,0.88); color: #111; font-weight: 650; }
    .shikimori-local__action.secondary { background: rgba(255,255,255,0.14); }
    .shikimori-local__action.tertiary { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.82); }
    .shikimori-local__action.focus, .shikimori-local__dropdown-item.focus, .shikimori-local__text-toggle.focus { outline: 2px solid #fff; outline-offset: 2px; }
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
    .shikimori-local__loading, .shikimori-local__empty, .shikimori-local__error, .shikimori-local__query { padding: 1em; opacity: 0.8; }
    .shikimori-local__more { padding: 1em; background: rgba(255,255,255,0.12); border-radius: 0.4em; cursor: pointer; text-align: center; }
    .shikimori-local__more.focus { background: rgba(255,255,255,0.25); }
    .shikimori-local__candidate { display: flex; gap: 1em; padding: 0.8em; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .shikimori-local__candidate.focus { background: rgba(255,255,255,0.12); }
    .shikimori-local__candidate img { width: 92px; border-radius: 0.3em; }
    .shikimori-local__manual { margin-top: 1em; display: flex; flex-direction: column; gap: 0.6em; }
    .shikimori-local__manual label { display: flex; align-items: center; gap: 0.5em; }
    .shikimori-local__manual input, .shikimori-local__manual select { padding: 0.5em; background: rgba(255,255,255,0.08); border: none; color: #fff; border-radius: 0.3em; }
    .shikimori-local__diag { display: grid; gap: 0.5em; margin-bottom: 1em; }
    .shikimori-local__diag div { padding: 0.4em; background: rgba(255,255,255,0.05); border-radius: 0.3em; }
  `;
  document.head.appendChild(style);
}

module.exports = { injectStyles };
