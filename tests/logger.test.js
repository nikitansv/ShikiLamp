const logger = require('../src/logger');

beforeEach(() => {
  logger.clear();
  logger.setDebug(true);
  ['log', 'warn', 'error'].forEach(method => jest.spyOn(console, method).mockImplementation(() => {}));
});
afterEach(() => { logger.clear(); logger.setDebug(false); jest.restoreAllMocks(); });

test('all console levels and stored diagnostics redact bearer and OAuth values', () => {
  const input = 'Bearer fixture-bearer access_token=fixture-access&refresh_token=fixture-refresh&client_secret=fixture-secret&code=fixture-code';
  ['log', 'warn', 'error', 'debug'].forEach(method => logger[method](input));
  const output = JSON.stringify([logger.getEntries(), console.log.mock.calls, console.warn.mock.calls, console.error.mock.calls]);
  ['fixture-bearer', 'fixture-access', 'fixture-refresh', 'fixture-secret', 'fixture-code'].forEach(secret => expect(output).not.toContain(secret));
  expect(output).toContain('[REDACTED]');
});

test('quoted secrets containing whitespace and escaped quotes are fully redacted', () => {
  logger.warn({ client_secret: 'prefix spaceSuffix', refresh_token: 'prefix"quoteSuffix', nested: { access_token: 'prefix\nlineSuffix' } });
  logger.error(new Error('client_secret="prefix errorSuffix"'));
  const output = JSON.stringify([logger.getEntries(), console.warn.mock.calls, console.error.mock.calls]);
  ['prefix', 'spaceSuffix', 'quoteSuffix', 'lineSuffix', 'errorSuffix'].forEach(secret => expect(output).not.toContain(secret));
});
