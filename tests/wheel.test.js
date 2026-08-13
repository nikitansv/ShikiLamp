const { JSDOM } = require('jsdom');
const lifecycle = require('../src/components/lifecycle');

function start(html) {
  global.Lampa = {
    Controller: {
      add: jest.fn(),
      toggle: jest.fn(),
      collectionSet: jest.fn(),
      collectionFocus: jest.fn()
    }
  };
  global.window.Lampa = global.Lampa;
  const instance = { html: html };
  lifecycle.addContentController(instance);
  return instance;
}

beforeEach(() => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
});

afterEach(() => {
  delete global.Lampa;
  delete global.document;
  delete global.window;
});

test('wheel scrolls a home rail horizontally', () => {
  const html = document.createElement('div');
  html.innerHTML = '<div class="shikimori-local"><div class="shikimori-local__row-items"><div>card</div></div></div>';
  document.body.appendChild(html);
  const rail = html.querySelector('.shikimori-local__row-items');
  Object.defineProperty(rail, 'scrollWidth', { value: 500 });
  Object.defineProperty(rail, 'clientWidth', { value: 100 });
  const instance = start(html);
  const event = new window.WheelEvent('wheel', { deltaY: 80, cancelable: true, bubbles: true });
  rail.dispatchEvent(event);
  expect(rail.scrollLeft).toBe(80);
  expect(event.defaultPrevented).toBe(true);
  instance.__shikimoriWheelRoot.remove();
});
