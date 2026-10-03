/**
 * Lampa main menu integration.
 */
const settings = require('../settings');
const logger = require('../logger');
const lifecycle = require('../components/lifecycle');

const MENU_CLASS = 'shikimori-local-menu-item';
const MENU_ACTION = 'shikimori_local';
let retryTimer = null;
let attempts = 0;

function register(retry) {
  clearTimeout(retryTimer);
  retryTimer = null;
  if (!retry) attempts = 0;
  const existing = document.querySelector('.' + MENU_CLASS);
  if (!settings.showMenu() || !settings.isEnabled()) {
    if (existing) existing.remove();
    attempts = 0;
    return;
  }

  if (existing) return;

  const body = getMenuBody();
  if (!body) {
    if (++attempts < 20) retryTimer = setTimeout(function () { register(true); }, 500);
    else logger.warn('Menu body not found');
    return;
  }

  const item = createMenuItem();
  body.appendChild(item);
  attempts = 0;
}

function getMenuBody() {
  const menu = document.querySelector('.menu__list');
  if (menu) return menu;
  const wrap = document.querySelector('.wrap__left .menu');
  if (wrap) return wrap.querySelector('.menu__list') || wrap;
  return null;
}

function createMenuItem() {
  const div = document.createElement('div');
  div.className = MENU_CLASS + ' menu__item selector';
  div.innerHTML = '<div class="menu__ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="menu__text">Shikimori</div>';
  div.setAttribute('data-action', MENU_ACTION);
  bindItemEvents(div);
  return div;
}

function bindItemEvents(item) {
  if (!item || item.__shikimoriMenuEventsBound) return;
  item.__shikimoriMenuEventsBound = true;
  lifecycle.bindAction(item, openHome);
}

function openHome() {
  if (settings.isEnabled() && typeof Lampa !== 'undefined' && Lampa.Activity) {
    Lampa.Activity.push({
      url: '',
      title: 'Shikimori',
      component: 'shikimori_local_home'
    });
  }
}

module.exports = { register, openHome, MENU_CLASS, MENU_ACTION };
