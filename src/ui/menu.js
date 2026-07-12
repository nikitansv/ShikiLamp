/**
 * Lampa main menu integration.
 */
const settings = require('../settings');
const logger = require('../logger');

const MENU_CLASS = 'shikimori-local-menu-item';
const MENU_ACTION = 'shikimori_local';

function register() {
  if (!settings.showMenu() || !settings.isEnabled()) {
    logger.log('Menu disabled by settings');
    return;
  }

  if (document.querySelector('.' + MENU_CLASS)) {
    logger.log('Menu item already exists');
    return;
  }

  const body = getMenuBody();
  if (!body) {
    logger.warn('Menu body not found, will retry');
    setTimeout(register, 500);
    return;
  }

  const item = createMenuItem();
  body.appendChild(item);

  Lampa.Listener.follow('menu', function (event) {
    if (event.type === 'start') {
      bindItemEvents(item);
    }
  });
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
  div.addEventListener('hover:enter', function () {
    openHome();
  });
  div.addEventListener('click', function () {
    openHome();
  });
  return div;
}

function bindItemEvents(item) {
  item.addEventListener('hover:enter', openHome);
}

function openHome() {
  if (typeof Lampa !== 'undefined' && Lampa.Activity) {
    Lampa.Activity.push({
      url: '',
      title: 'Shikimori',
      component: 'shikimori_local_home'
    });
  }
}

module.exports = { register, openHome, MENU_CLASS, MENU_ACTION };
