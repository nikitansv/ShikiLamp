const { JSDOM } = require('jsdom');
const AuthUi = require('../src/ui/auth');

beforeEach(() => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.KeyboardEvent = dom.window.KeyboardEvent;
});

afterEach(() => {
  delete global.KeyboardEvent;
  delete global.document;
  delete global.window;
});

test('renders local QR and authorization URL without third-party service', () => {
  const url = 'https://shikimori.io/oauth/authorize?client_id=test';
  const ui = AuthUi.open({ url, onCode: jest.fn() });

  const image = document.querySelector('.shikilamp-auth__qr');
  expect(image.src).toMatch(/^data:image\/gif;base64,/);
  expect(document.body.textContent).toContain(url);
  expect(document.body.innerHTML).not.toContain('qrserver');
  expect(document.body.innerHTML).not.toContain('orcascan');
  ui.close();
});

test('code button requests code and closes overlay', () => {
  const onCode = jest.fn();
  const ui = AuthUi.open({ url: 'https://example.com', onCode });
  document.querySelector('[data-action="code"]').click();
  expect(onCode).toHaveBeenCalledTimes(1);
  expect(document.querySelector('.shikilamp-auth')).toBeNull();
});

test('Escape closes overlay', () => {
  AuthUi.open({ url: 'https://example.com', onCode: jest.fn() });
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(document.querySelector('.shikilamp-auth')).toBeNull();
});
