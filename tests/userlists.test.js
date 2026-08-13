const { JSDOM } = require('jsdom');
const UserLists = require('../src/components/userlists');
const storage = require('../src/mapping/storage');

function mockLampa() {
  global.Lampa = {
    Activity: { push: jest.fn() },
    Controller: {
      collectionSet: jest.fn(),
      collectionFocus: jest.fn()
    },
    Storage: {
      get: function (key, def) { return def; },
      set: function () {}
    }
  };
}

beforeEach(() => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.Event = dom.window.Event;
  global.requestAnimationFrame = function (cb) { return setTimeout(cb, 0); };
  storage.setTestStore({ get: function () { return ''; }, set: function () {} });
  mockLampa();
});

afterEach(() => {
  delete global.Lampa;
  delete global.window;
  delete global.document;
  delete global.Event;
  delete global.requestAnimationFrame;
  storage.setTestStore(null);
});

test('userlists openAnime falls back to shikimori card when matcher returns no match', function (done) {
  jest.spyOn(UserLists.prototype, 'renderTabs').mockImplementation(function () {});

  const auth = require('../src/auth');
  jest.spyOn(auth, 'getToken').mockReturnValue('token');
  jest.spyOn(auth, 'getCachedUser').mockReturnValue({ id: 1, nickname: 'test' });

  const userlists = new UserLists({ status: 'planned' });
  userlists.create();

  const anime = {
    shikimori_id: 100,
    title: 'No Match List Anime',
    year: 2024,
    kind: 'movie',
    score: 8
  };

  userlists.openAnime(anime);

  setTimeout(function () {
    expect(Lampa.Activity.push).toHaveBeenCalled();
    const call = Lampa.Activity.push.mock.calls[0][0];
    expect(call.component).toBe('shikimori_local_anime');
    expect(call.anime).toBe(anime);
    done();
  }, 50);
});

test('planned list renders direct filter results', () => {
  const userlists = new UserLists({ status: 'planned' });
  userlists.html = document.createElement('div');
  userlists.results = document.createElement('div');
  userlists.html.appendChild(userlists.results);
  userlists.refocus = jest.fn();

  userlists.renderResults([
    { id: 'ongoing', list: [{ shikimori_id: 1, title: 'Current', score: 8 }] },
    { id: 'released', list: [{ shikimori_id: 2, title: 'Released', score: 7 }] },
    { id: 'upcoming', list: [{ shikimori_id: 3, title: 'Upcoming', score: 7 }] }
  ], false);

  const cards = userlists.results.querySelectorAll('.shikimori-local__result');
  expect(cards).toHaveLength(3);
  expect(cards[0].__shikimoriAnime.title).toBe('Current');
});

test('planned list renders current, released, and upcoming carousels', () => {
  const userlists = new UserLists({ status: 'planned' });
  userlists.html = document.createElement('div');
  userlists.results = document.createElement('div');
  userlists.html.appendChild(userlists.results);
  userlists.refocus = jest.fn();

  userlists.renderResults([
    { id: 'ongoing', list: [{ shikimori_id: 1, title: 'Current', score: 8 }] },
    { id: 'released', list: [{ shikimori_id: 2, title: 'Released', score: 8 }] },
    { id: 'upcoming', list: [{ shikimori_id: 3, title: 'Upcoming', score: 8 }] }
  ], false);

  expect(userlists.results.querySelectorAll('[data-group]')).toHaveLength(3);
  expect(userlists.results.querySelector('[data-group="ongoing"] .shikimori-local__result').__shikimoriAnime.title).toBe('Current');
  expect(userlists.results.querySelector('[data-group="released"] .shikimori-local__result').__shikimoriAnime.title).toBe('Released');
  expect(userlists.results.querySelector('[data-group="upcoming"] .shikimori-local__result').__shikimoriAnime.title).toBe('Upcoming');
});

test('watching list renders current and released carousels', () => {
  const userlists = new UserLists({ status: 'watching' });
  userlists.html = document.createElement('div');
  userlists.results = document.createElement('div');
  userlists.html.appendChild(userlists.results);
  userlists.refocus = jest.fn();

  userlists.renderResults([
    { id: 'ongoing', list: [{ shikimori_id: 1, title: 'Current', score: 8 }] },
    { id: 'released', list: [{ shikimori_id: 2, title: 'Released', score: 8 }] }
  ], false);

  expect(userlists.results.querySelectorAll('[data-group]')).toHaveLength(2);
});
