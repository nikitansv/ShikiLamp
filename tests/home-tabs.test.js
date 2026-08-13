const { JSDOM } = require('jsdom');

jest.mock('../src/api', () => ({
  ongoing: jest.fn(() => Promise.resolve([]))
}));

const Home = require('../src/components/home');

beforeEach(() => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.Lampa = { Activity: { push: jest.fn() } };
});

afterEach(() => {
  delete global.Lampa;
  delete global.document;
  delete global.window;
});

test('home renders tabs without side panel', () => {
  const home = new Home();
  home.create();

  expect(home.html.querySelectorAll('[data-tab]')).toHaveLength(3);
  expect(home.html.querySelector('.shikimori-local__side-panel')).toBeNull();
});

test('tabs open their destination components', () => {
  const home = new Home();
  home.create();

  home.openTab('lists');
  expect(global.Lampa.Activity.push).toHaveBeenLastCalledWith(expect.objectContaining({ component: 'shikimori_local_userlists' }));

  home.openTab('filter');
  expect(global.Lampa.Activity.push).toHaveBeenLastCalledWith(expect.objectContaining({ component: 'shikimori_local_filter' }));
});
