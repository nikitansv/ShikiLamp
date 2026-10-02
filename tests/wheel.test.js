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

test('wheel at the rail edge scrolls its page instead of being trapped', () => {
  const html = document.createElement('div');
  html.innerHTML = '<div class="shikimori-local"><div class="shikimori-local__row-items"><div>card</div></div></div>';
  document.body.appendChild(html);
  const page = html.firstElementChild;
  const rail = page.firstElementChild;
  Object.defineProperties(rail, { scrollWidth: { value: 500 }, clientWidth: { value: 100 } });
  Object.defineProperties(page, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } });
  rail.scrollLeft = 400;
  start(html);
  const event = new window.WheelEvent('wheel', { deltaY: 80, cancelable: true, bubbles: true });
  rail.dispatchEvent(event);
  expect(rail.scrollLeft).toBe(400);
  expect(page.scrollTop).toBe(80);
  expect(event.defaultPrevented).toBe(true);
});

test('wheel scrolls the filter main container and respects line deltas', () => {
  const html = document.createElement('div');
  html.innerHTML = '<div class="shikimori-local"><div class="shikimori-local__filter-main"><div>card</div></div></div>';
  document.body.appendChild(html);
  const main = html.querySelector('.shikimori-local__filter-main');
  Object.defineProperties(main, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } });
  start(html);
  main.firstElementChild.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 3, deltaMode: 1, cancelable: true, bubbles: true }));
  expect(main.scrollTop).toBe(48);
});

test('wheel binding survives replacement of the inner page', () => {
  const html = document.createElement('div');
  html.innerHTML = '<div class="shikimori-local"></div>';
  document.body.appendChild(html);
  start(html);
  html.innerHTML = '<div class="shikimori-local"><div>card</div></div>';
  const page = html.firstElementChild;
  Object.defineProperties(page, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } });
  page.firstElementChild.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 80, cancelable: true, bubbles: true }));
  expect(page.scrollTop).toBe(80);
});
