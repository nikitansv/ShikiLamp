const qrcode = require('qrcode-generator');

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
  if (previous) previous.remove();

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
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    root.remove();
  }
  function onKey(event) {
    const key = event.key || event.code;
    const code = event.keyCode || event.which;
    if (key === 'Escape' || key === 'Backspace' || key === 'BrowserBack' || code === 8 || code === 27 || code === 461 || code === 10009) {
      event.preventDefault();
      close();
    }
  }

  root.querySelector('[data-action="code"]').addEventListener('click', function () {
    close();
    if (options.onCode) options.onCode();
  });
  root.querySelector('[data-action="cancel"]').addEventListener('click', close);
  document.addEventListener('keydown', onKey, true);
  setTimeout(function () {
    const button = root.querySelector('[data-action="code"]');
    if (button && button.focus) button.focus();
  }, 0);
  return { close: close, element: root };
}

module.exports = { open: open, qrDataUrl: qrDataUrl };
