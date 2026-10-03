const { JSDOM } = require('jsdom');
const cards = require('../src/ui/cards');

beforeEach(() => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.Event = dom.window.Event;
});

afterEach(() => {
  delete global.Event;
  delete global.document;
  delete global.window;
});

test('createDomCard returns consistent selector card with escaped fields', () => {
  const anime = {
    shikimori_id: 1,
    title: '<Test>',
    year: 2024,
    kind: 'tv',
    score: 8.5,
    poster: 'https://example.com/poster.jpg'
  };
  const onEnter = jest.fn();
  const onLongPress = jest.fn();

  const card = cards.createDomCard(anime, { onEnter, onLongPress });

  expect(card.classList.contains('shikimori-local__result')).toBe(true);
  expect(card.classList.contains('selector')).toBe(true);
  expect(card.__shikimoriAnime).toBe(anime);
  expect(card.querySelector('.shikimori-local__result-title').textContent).toBe('<Test>');
  expect(card.querySelector('.shikimori-local__result-poster img').src).toBe('https://example.com/poster.jpg');
  expect(card.querySelector('.shikimori-local__result-score').textContent).toBe('8.5');
  expect(card.querySelector('.shikimori-local__result-score').classList.contains('score-high')).toBe(true);

  card.dispatchEvent(new Event('hover:enter'));
  expect(onEnter).toHaveBeenCalledTimes(1);

  const contextEvent = new Event('contextmenu');
  contextEvent.preventDefault = jest.fn();
  card.dispatchEvent(contextEvent);
  expect(contextEvent.preventDefault).toHaveBeenCalled();
  expect(onLongPress).toHaveBeenCalledTimes(1);

  card.dispatchEvent(new Event('hover:long'));
  expect(onLongPress).toHaveBeenCalledTimes(2);
});

test('createDomCard omits long-press handler when not provided', () => {
  const anime = { shikimori_id: 2, title: 'Only Enter', year: 2023, kind: 'movie', score: 7 };
  const onEnter = jest.fn();
  const card = cards.createDomCard(anime, { onEnter });

  const contextEvent = new Event('contextmenu');
  contextEvent.preventDefault = jest.fn();
  card.dispatchEvent(contextEvent);
  expect(contextEvent.preventDefault).not.toHaveBeenCalled();
});

test('createDomCard renders exact Shikimori score on poster', () => {
  const anime = { shikimori_id: 3, title: 'List', year: 2022, kind: 'ova', score: 6 };
  const card = cards.createDomCard(anime);
  expect(card.querySelector('.shikimori-local__result-score').textContent).toBe('6');
  expect(card.querySelector('.shikimori-local__result-meta')).toBeNull();
});

test('createDomCard colors low and medium scores', () => {
  const low = cards.createDomCard({ shikimori_id: 4, title: 'Low', score: 5.9 });
  const medium = cards.createDomCard({ shikimori_id: 5, title: 'Medium', score: 6 });
  expect(low.querySelector('.shikimori-local__result-score').classList.contains('score-low')).toBe(true);
  expect(medium.querySelector('.shikimori-local__result-score').classList.contains('score-mid')).toBe(true);
});

test('failed preferred poster falls back once per URL, including after asynchronous replacement', () => {
  const anime = { title: 'Poster', poster: 'https://example.com/primary.webp', poster_fallbacks: ['https://example.com/alternate.jpg'] };
  const card = cards.createDomCard(anime);
  const image = card.querySelector('img');
  image.dispatchEvent(new Event('error'));
  expect(image.src).toBe('https://example.com/alternate.jpg');
  anime.poster = 'https://example.com/stale-mapping.jpg';
  cards.loadPoster(image, anime);
  image.dispatchEvent(new Event('error'));
  expect(image.src).toBe('https://example.com/alternate.jpg');
  cards.loadPoster(image, anime);
  expect(image.src).toBe('https://example.com/alternate.jpg');
  image.dispatchEvent(new Event('error'));
  expect(image.hasAttribute('src')).toBe(false);
  expect(image.style.display).toBe('none');
  expect(card.querySelector('.shikimori-local__poster-fallback').textContent).toBe('Poster');
});

test('missing poster shows escaped title placeholder without an empty image request', () => {
  const card = cards.createDomCard({ title: '<No poster>' });
  expect(card.querySelector('img').hasAttribute('src')).toBe(false);
  expect(card.querySelector('.shikimori-local__poster-fallback').textContent).toBe('<No poster>');
});
