const { JSDOM } = require('jsdom');
const Diagnostics = require('../src/components/diagnostics');
const logger = require('../src/logger');
const settings = require('../src/settings');
const auth = require('../src/auth');

let dom, screen;
beforeEach(() => {
  dom = new JSDOM('<html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.Lampa = {};
  logger.clear();
  jest.spyOn(settings, 'getApiBaseUrl').mockReturnValue('https://example.com/api?access_token=fixture-url');
  jest.spyOn(settings, 'getExperimentalToken').mockReturnValue('');
  jest.spyOn(auth, 'getCachedUser').mockReturnValue({ id: 1, nickname: 'Bearer fixture-user' });
  screen = new Diagnostics();
});
afterEach(() => {
  screen.destroy();
  jest.restoreAllMocks();
  logger.clear();
  dom.window.close();
  delete global.window; delete global.document; delete global.Lampa;
});

test('diagnostic errors are redacted and escaped before rendering', () => {
  screen.log('Bearer fixture-error <img src=x onerror="fail()">');
  screen.create();
  expect(screen.logEntries[0]).not.toContain('fixture-error');
  expect(screen.html.querySelector('img')).toBeNull();
  expect(screen.html.textContent).toContain('<img src=x');
  expect(screen.html.textContent).not.toContain('fixture-url');
  expect(screen.html.textContent).not.toContain('fixture-user');
});

test('diagnostic export redacts nested text without truncating or breaking JSON', () => {
  screen.log('access_token=fixture-log');
  screen.listCheck = {
    user: { id: 1, nickname: 'Bearer fixture-nickname' },
    planned: { titles: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, title: 'Title ' + i + ' client_secret=fixture-title' })) }
  };
  const report = screen.buildReport();
  expect(report.length).toBeGreaterThan(1000);
  expect(report).not.toMatch(/fixture-(?:log|url|nickname|title)/);
  const data = JSON.parse(report);
  expect(data.user_lists.planned.titles).toHaveLength(30);
  expect(data.user_lists.planned.titles[29].id).toBe(30);
  expect(data.api_base_url).toContain('[REDACTED]');
});
