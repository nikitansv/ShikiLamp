// Optional live public API/CORS probe. No account data or tokens are used.
const assert = require('node:assert/strict');
const launchBrowser = require('./browser');
const graphql = require('../src/api/graphql');

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>ShikiLamp public API probe</title>');
    const result = await page.evaluate(async body => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch('https://shikimori.io/api/graphql', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal: controller.signal
        });
        const json = await response.json();
        if (!response.ok || json.errors) throw new Error('HTTP ' + response.status + ': ' + JSON.stringify(json.errors || []));
        return { status: response.status, count: json.data && json.data.animes && json.data.animes.length };
      } finally { clearTimeout(timeout); }
    }, graphql.searchAnimes('Frieren', 2, 1));
    assert.ok(result.count > 0, 'Public GraphQL search must return anime');
    console.log('Live public API probe:', JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
