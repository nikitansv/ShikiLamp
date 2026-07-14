const { JSDOM } = require('jsdom');
const Line = require('../src/components/line');
const storage = require('../src/mapping/storage');

function mockLampa() {
  global.Lampa = {
    Activity: { push: jest.fn() },
    Controller: {
      collectionSet: jest.fn(),
      collectionFocus: jest.fn()
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

test('line openAnime falls back to shikimori card when matcher returns no match', function (done) {
  const line = new Line({ section: 'popular' });
  line.create();

  const anime = {
    shikimori_id: 99,
    title: 'No Match Anime',
    year: 2025,
    kind: 'tv',
    score: 7
  };

  line.openAnime(anime);

  setTimeout(function () {
    expect(Lampa.Activity.push).toHaveBeenCalled();
    const call = Lampa.Activity.push.mock.calls[0][0];
    expect(call.component).toBe('shikimori_local_anime');
    expect(call.anime).toBe(anime);
    done();
  }, 50);
});
