const titles = require('../src/mapping/titles');
const matcher = require('../src/mapping/matcher');
const scoring = require('../src/mapping/scoring');

describe('flexible TV title search', () => {
  const previousLampa = global.Lampa;
  afterEach(() => { global.Lampa = previousLampa; });

  test.each([
    ['Агент времени 3', 'Агент времени'],
    ['Агент времени: 3 сезон', 'Агент времени'],
    ['Link Click Season 3', 'Link Click'],
    ['Link Click 3rd Season', 'Link Click'],
    ['Link Click III', 'Link Click'],
    ['86', '86'],
    ['Re:Zero', 'Re:Zero'],
    ['3-gatsu no Lion', '3-gatsu no Lion'],
    ['Anime 2024', 'Anime 2024']
  ])('%s -> %s', (input, expected) => {
    expect(titles.baseTitle(input, 'tv')).toBe(expected);
  });

  test('keeps movie sequels and original title variants', () => {
    expect(titles.baseTitle('Movie 3', 'movie')).toBe('Movie 3');
    expect(titles.queries({ title: 'Агент времени 3', kind: 'tv' }))
      .toEqual(['Агент времени', 'Агент времени 3']);
  });

  test('deduplicates and bounds localized titles and aliases', () => {
    const queries = titles.queries({ title: 'Link Click', original_title: 'link click',
      english_title: 'English', aliases: Array.from({ length: 20 }, (_, i) => 'Alias ' + i) });
    expect(queries.slice(0, 2)).toEqual(['Link Click', 'English']);
    expect(queries).toHaveLength(8);
    expect(titles.queries({})).toEqual([]);
  });

  test('finds a base TV title, removes duplicate results, keeps media types separate', async () => {
    const search = jest.fn((params, success) => success({
      tv: { results: [{ id: 1, name: 'Агент времени' }] },
      movie: { results: [{ id: 1, title: 'Агент времени' }] }
    }));
    global.Lampa = { Api: { search } };
    const anime = { title: 'Агент времени 3', kind: 'tv' };
    const results = await matcher.searchTmdb(anime);
    expect(search.mock.calls.map(call => call[0].query)).toEqual(['Агент времени', 'Агент времени 3']);
    expect(results).toHaveLength(2);
    expect(results[0].type).toBe('tv');
    expect(anime.title).toBe('Агент времени 3');
  });

  test('searches alternate names after errors and synchronous exceptions', async () => {
    global.Lampa = { Api: { search: jest.fn((params, success, failure) => {
      if (params.query === 'Агент времени') throw new Error('offline');
      if (params.query === 'Агент времени 3') return failure();
      success({ tv: { results: [{ id: 2, name: 'Link Click' }] } });
    }) } };
    const results = await matcher.searchTmdb({ title: 'Агент времени 3', english_title: 'Link Click', kind: 'tv' });
    expect(results).toHaveLength(1);
    expect(results[0].item.id).toBe(2);
  });

  test('empty titles do not issue requests', async () => {
    global.Lampa = { Api: { search: jest.fn() } };
    expect(await matcher.searchTmdb({})).toEqual([]);
    expect(global.Lampa.Api.search).not.toHaveBeenCalled();
  });

  test('base-title scoring improves TV matches without changing movies', () => {
    const anime = { title: 'Link Click Season 3', kind: 'tv' };
    const candidate = { name: 'Link Click', media_type: 'tv' };
    expect(scoring.score(anime, candidate)).toBeGreaterThan(scoring.score(
      Object.assign({}, anime, { kind: 'movie' }), Object.assign({}, candidate, { media_type: 'movie' })
    ));
  });
});
