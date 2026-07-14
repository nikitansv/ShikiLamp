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
