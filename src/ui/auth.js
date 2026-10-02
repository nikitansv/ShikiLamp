const qrcode = require('qrcode-generator');
const lifecycle = require('../components/lifecycle');

function qrDataUrl(value) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  return qr.createDataURL(7, 12);
}

function open(options) {
  options = options || {};
  const url = String(options.url || '');
  if (!url) throw new Error('OAuth URL пустой');

  const previous = document.querySelector('.shikilamp-auth');
  if (previous && previous.__shikimoriClose) previous.__shikimoriClose();
  else if (previous) previous.remove();

  const root = document.createElement('div');
  root.className = 'shikilamp-auth';
  root.innerHTML =
    '<div class="shikilamp-auth__panel">' +
      '<div class="shikilamp-auth__title">Войти через Shikimori</div>' +
      '<div class="shikilamp-auth__hint">Отсканируйте QR-код телефоном, подтвердите доступ и получите код авторизации.</div>' +
      '<img class="shikilamp-auth__qr" alt="QR Shikimori" src="' + qrDataUrl(url) + '">' +
      '<div class="shikilamp-auth__url"></div>' +
      '<div class="shikilamp-auth__actions">' +
        '<button class="selector" data-action="code">Ввести полученный код</button>' +
        '<button class="selector" data-action="cancel">Отмена</button>' +
      '</div>' +
    '</div>';
  root.querySelector('.shikilamp-auth__url').textContent = url;
  document.body.appendChild(root);

  let closed = false;
  let focusTimer;
  let lastAction = 0;
  const previousController = typeof Lampa !== 'undefined' && Lampa.Controller && Lampa.Controller.enabled ? Lampa.Controller.enabled().name : '';
  const controllerName = 'shikilamp_auth';

  function activate(action) {
    if (closed) return;
    const now = Date.now();
    if (now - lastAction < 100) return;
    lastAction = now;
    action();
  }

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(focusTimer);
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    if (typeof Lampa !== 'undefined' && Lampa.Controller && previousController) {
      Lampa.Controller.toggle(previousController);
    }
  }
  function onKey(event) {
    const key = event.key || event.code;
    const code = event.keyCode || event.which;
    if (key === 'Escape' || key === 'Backspace' || key === 'BrowserBack' || code === 8 || code === 27 || code === 461 || code === 10009) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  }

  const codeButton = root.querySelector('[data-action="code"]');
  const cancelButton = root.querySelector('[data-action="cancel"]');
  const codeAction = function () {
    activate(function () {
      close();
      if (options.onCode) options.onCode();
    });
  };
  const cancelAction = function () { activate(close); };
  lifecycle.bindAction(codeButton, codeAction);
  lifecycle.bindAction(cancelButton, cancelAction);
  document.addEventListener('keydown', onKey, true);

  if (typeof Lampa !== 'undefined' && Lampa.Controller) {
    Lampa.Controller.add(controllerName, {
      toggle: function () {
        Lampa.Controller.collectionSet(root);
        Lampa.Controller.collectionFocus(codeButton, root);
      },
      up: function () { if (typeof Navigator !== 'undefined' && Navigator.move) Navigator.move('up'); },
      down: function () { if (typeof Navigator !== 'undefined' && Navigator.move) Navigator.move('down'); },
      left: function () { if (typeof Navigator !== 'undefined' && Navigator.move) Navigator.move('left'); },
      right: function () { if (typeof Navigator !== 'undefined' && Navigator.move) Navigator.move('right'); },
      back: close,
      enter: function () {
        const focused = root.querySelector('.selector.focus') || codeButton;
        if (focused) focused.dispatchEvent(new Event('hover:enter'));
      }
    });
    Lampa.Controller.toggle(controllerName);
  }

  focusTimer = setTimeout(function () {
    if (closed) return;
    const button = root.querySelector('[data-action="code"]');
    if (button && button.focus) button.focus({ preventScroll: true });
  }, 0);
  root.__shikimoriClose = close;
  return { close: close, element: root };
}

module.exports = { open: open, qrDataUrl: qrDataUrl };
