/**
 * CSS styles for Shikimori Local plugin screens.
 */
function injectStyles() {
  if (document.getElementById('shikimori-local-styles')) return;
  const style = document.createElement('style');
  style.id = 'shikimori-local-styles';
  style.textContent = `
    .shikimori-local { padding: 1.5em; color: #fff; }
    .shikimori-local__head { font-size: 1.5em; margin-bottom: 1em; font-weight: 600; }
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
    .shikimori-local__loading, .shikimori-local__empty, .shikimori-local__error { padding: 1em; opacity: 0.8; }
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
