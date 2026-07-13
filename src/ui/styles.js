/**
 * CSS styles for Shikimori Local plugin screens.
 */
function injectStyles() {
  if (document.getElementById('shikimori-local-styles')) return;
  const style = document.createElement('style');
  style.id = 'shikimori-local-styles';
  style.textContent = `
    .shikimori-local { padding: 1.5em; color: #fff; max-height: 100vh; overflow-y: auto; box-sizing: border-box; }
    .shikimori-local.home-page { padding-bottom: 6em; }
    .shikimori-local__side-panel { position: fixed; top: 5.5em; right: 0; width: 19em; height: calc(100vh - 8em); border-radius: 0.8em 0 0 0.8em; background: rgba(0,0,0,0.34); border: 1px solid rgba(255,255,255,0.12); opacity: 0.35; transform: translateX(18.2em); pointer-events: none; transition: opacity 0.12s ease, transform 0.12s ease, background 0.12s ease; }
    .shikimori-local__side-panel.visible, .shikimori-local__side-panel.focus { opacity: 1; transform: translateX(0); background: rgba(0,0,0,0.46); }
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
    .shikimori-local__actions { margin-top: 1em; display: flex; gap: 0.8em; flex-wrap: wrap; }
    .shikimori-local__action { padding: 0.6em 1em; background: rgba(255,255,255,0.12); border-radius: 0.4em; cursor: pointer; }
    .shikimori-local__action.focus { background: rgba(255,255,255,0.25); }
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
