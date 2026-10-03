const { JSDOM } = require('jsdom');
const Mapping = require('../src/components/mapping');
const Anime = require('../src/components/anime');
const matcher = require('../src/mapping/matcher');

let dom, screen;
beforeEach(() => {
  dom = new JSDOM('<html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.Lampa = { Noty: { show: jest.fn() }, Activity: { push: jest.fn() } };
  jest.spyOn(matcher, 'searchTmdb').mockResolvedValue([]);
  jest.spyOn(matcher, 'applyBestPoster').mockResolvedValue({});
  jest.spyOn(matcher, 'saveManual').mockReturnValue({ tmdb_id: 10 });
  jest.spyOn(matcher, 'openLampaCard').mockReturnValue(true);
});
afterEach(() => {
  if (screen) screen.destroy();
  screen = null;
  jest.restoreAllMocks();
  dom.window.close();
  delete global.window; delete global.document; delete global.Lampa; delete global.prompt;
});

test('manual mapping save failure reports error without success or navigation', () => {
  matcher.saveManual.mockImplementation(() => { throw new Error('MAPPING_SAVE_FAILED'); });
  screen = new Mapping({ anime: { shikimori_id: 1 } });
  expect(() => screen.save(10, 'tv', 1, 0)).not.toThrow();
  expect(matcher.openLampaCard).not.toHaveBeenCalled();
  expect(Lampa.Noty.show).toHaveBeenCalledTimes(1);
  expect(Lampa.Noty.show).toHaveBeenCalledWith('Не удалось сохранить соответствие');
});

test.each([
  [0, 'tv', 1, 0], [-1, 'tv', 1, 0], [1.5, 'tv', 1, 0], [NaN, 'tv', 1, 0],
  [10, 'unknown', 1, 0], [10, 'tv', 0, 0], [10, 'tv', -1, 0], [10, 'tv', 1.5, 0],
  [10, 'tv', 1, NaN], [10, 'tv', 1, 0.5]
])('invalid mapping %j/%s/%j/%j is not saved', (id, type, season, offset) => {
  screen = new Mapping({ anime: { shikimori_id: 1 } });
  screen.save(id, type, season, offset);
  expect(matcher.saveManual).not.toHaveBeenCalled();
  expect(matcher.openLampaCard).not.toHaveBeenCalled();
});

test('manual form rejects partially numeric IDs and accepts a valid mapping', () => {
  screen = new Mapping({ anime: { shikimori_id: 1 } }); screen.create();
  screen.html.querySelector('.shikimori-local__manual-id').value = '10garbage';
  screen.html.querySelector('[data-action="manual-save"]').click();
  expect(matcher.saveManual).not.toHaveBeenCalled();
  screen.html.querySelector('.shikimori-local__manual-id').value = '10';
  screen.html.querySelector('[data-action="manual-save"]').click();
  expect(matcher.saveManual).toHaveBeenCalledWith(screen.anime, 10, 'tv', 1, 0, { poster: '' });
  expect(matcher.openLampaCard).toHaveBeenCalledTimes(1);
});

test.each([0, 1])('canceling candidate prompt %i does not save or open a mapping', async cancelAt => {
  matcher.searchTmdb.mockResolvedValue([{ type: 'tv', item: { id: 10, name: 'Fixture' }, score: 0.8 }]);
  screen = new Mapping({ anime: { shikimori_id: 1 } }); screen.create();
  await Promise.resolve();
  global.prompt = jest.fn().mockReturnValueOnce(cancelAt === 0 ? null : '1').mockReturnValueOnce(null);
  screen.html.querySelector('.shikimori-local__candidate').click();
  expect(matcher.saveManual).not.toHaveBeenCalled();
  expect(matcher.openLampaCard).not.toHaveBeenCalled();
});

test('initial candidate search includes alternate titles; edited query replaces them', () => {
  Lampa.Input = { edit: jest.fn((options, submit) => submit('Custom query')) };
  const anime = { shikimori_id: 1, title: 'Агент времени 3', original_title: 'Shiguang Dailiren', english_title: 'Link Click', kind: 'tv', aliases: ['Link Click III'] };
  screen = new Mapping({ anime }); screen.create();
  expect(matcher.searchTmdb).toHaveBeenLastCalledWith(anime);
  screen.changeQuery();
  expect(matcher.searchTmdb).toHaveBeenLastCalledWith(expect.objectContaining({
    title: 'Custom query', original_title: 'Custom query', english_title: '', aliases: []
  }));
});

test.each(['destroyed', 'paused', 'save failure'])('Lampa search selection handles %s without opening or claiming success', state => {
  Lampa.Search = { open: jest.fn() };
  Lampa.Api = { availableDiscovery: () => [{ name: 'TMDB' }] };
  screen = new Anime({ anime: { shikimori_id: 1, title: 'Fixture' } }); screen.create();
  screen.openLampaSearch();
  const select = Lampa.Search.open.mock.calls[0][0].sources[0].onSelect;
  if (state === 'destroyed') screen.destroy();
  else if (state === 'paused') screen.__shikimoriActive = false;
  else matcher.saveManual.mockImplementation(() => { throw new Error('MAPPING_SAVE_FAILED'); });
  const done = jest.fn();
  expect(() => select({ item_data: { id: 10, name: 'Fixture' } }, done)).not.toThrow();
  expect(done).toHaveBeenCalledTimes(1);
  expect(matcher.openLampaCard).not.toHaveBeenCalled();
  expect(Lampa.Noty.show).not.toHaveBeenCalledWith('Соответствие сохранено');
  if (state !== 'save failure') expect(matcher.saveManual).not.toHaveBeenCalled();
});
