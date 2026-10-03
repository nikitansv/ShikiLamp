// Integration check against the real Lampa application and public Shikimori API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const createServer = require('./lampa-server');
const launchBrowser = require('./browser');

async function main() {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'shikilamp-real-lampa-'));
  const hostDir = process.env.LAMPA_HOST_DIR || path.join(output, 'lampa');
  if (!process.env.LAMPA_HOST_DIR) {
    execFileSync('git', ['clone', '--depth', '1', 'https://github.com/yumata/lampa.git', hostDir], { timeout: 60000, stdio: 'inherit' });
  }
  assert.ok(fs.existsSync(path.join(hostDir, 'app.min.js')), 'LAMPA_HOST_DIR must contain the compiled yumata/lampa app');
  const server = createServer(hostDir);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  let browser;
  const checks = [];
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    const pluginErrors = [];
    page.on('pageerror', error => { if (String(error.stack).includes('ShikiLamp.js')) pluginErrors.push(error.message); });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.appready || window.Lampa && Lampa.Controller.enabled().name === 'language', { timeout: 60000 });
    if (!await page.evaluate(() => window.appready)) await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.appready, { timeout: 60000 });
    // Lampa starts its saved/default Activity after appready; let that startup finish first.
    await page.waitForFunction(() => Lampa.Activity.active() && document.querySelector('.activity--active'), { timeout: 15000 });
    const version = await page.evaluate(() => Lampa.Manifest.app_version);
    await page.evaluate(url => Lampa.Plugins.add({ url: url + '/ShikiLamp.js', status: 1, name: 'ShikiLamp local test' }), url);
    await page.waitForFunction(() => window.__shikimori_local_ready, { timeout: 15000 });
    checks.push('plugin installed through the real Lampa loader');

    // The newest matching screen is current; covered Activities remain mounted.
    async function push(component, data = {}) {
      await page.evaluate(({ component, data }) => Lampa.Activity.push(Object.assign({ url: '', title: 'ShikiLamp test', component }, data)), { component, data });
    }
    async function waitImages(screen) {
      await page.waitForFunction(screen => {
        const root = screen === '.filter-page'
          ? document.querySelector('.shikimori-filter-activity:not(.shiki-inactive) ' + screen)
          : document.querySelector('.activity--active ' + screen);
        const images = root && Array.from(root.querySelectorAll('img'));
        return images && images.length && images.every(image => image.complete && image.naturalWidth > 0);
      }, { timeout: 45000 }, screen);
    }
    async function waitController(name) {
      await page.waitForFunction(name => Lampa.Controller.enabled().name === name, { timeout: 5000 }, name);
    }
    async function focusSetting(name) {
      await page.evaluate(name => Lampa.Controller.collectionFocus(document.querySelector('.settings [data-name="' + name + '"]')), name);
    }
    async function screenshot(name) {
      await page.evaluate(() => new Promise(resolve => {
        const start = performance.now();
        function settled() {
          const moving = document.getAnimations().some(animation => animation.playState === 'running' && animation.effect.getTiming().iterations !== Infinity);
          if (performance.now() - start >= 400 && !moving) resolve();
          else requestAnimationFrame(settled);
        }
        settled();
      }));
      await page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled', timeout: 15000 });
    }

    await push('shikimori_local_home');
    await waitImages('.home-page');
    const original = await page.evaluate(() => Object.assign({}, Array.from(document.querySelectorAll('.home-page')).at(-1).querySelector('.shikimori-local__result').__shikimoriAnime));
    checks.push('home posters load from the live API');
    await screenshot('home');

    await page.evaluate(anime => Lampa.Storage.set('shikimori_local_mappings', JSON.stringify({ v: 1, mappings: {
      [anime.shikimori_id]: { shikimori_id: anime.shikimori_id, tmdb_id: 1, tmdb_type: 'tv', poster: location.origin + '/missing-poster.jpg' }
    } })), original);
    await push('shikimori_local_home');
    await waitImages('.home-page');
    const fallback = await page.evaluate(() => Array.from(document.querySelectorAll('.home-page')).at(-1).querySelector('img').__shikimoriPoster);
    assert.ok(fallback.failed.some(url => url.endsWith('/missing-poster.jpg')));
    checks.push('broken saved TMDB poster falls back to a real Shikimori image');

    // Exercise authenticated UI paths without using or transmitting a real user's token.
    // Only the private list response is substituted with public REST anime records;
    // the host, plugin, GraphQL enrichment and image requests remain real.
    const personalFixture = await Promise.all([61607, 60692, 58749].map(async id => {
      const response = await fetch('https://shikimori.io/api/animes/' + id);
      assert.ok(response.ok, 'Public REST anime must be reachable');
      return response.json();
    }));
    assert.ok(personalFixture.some(anime => anime.image.preview.includes('/missing_')), 'Fixture must reproduce a successful 404 image asset');
    const missingImage = await fetch('https://shikimori.io' + personalFixture[0].image.preview);
    assert.equal(missingImage.status, 200);
    checks.push('real REST missing poster is a successful HTTP 200 image, not an image error');
    await page.setRequestInterception(true);
    const listRequests = [];
    const personalRequests = request => {
      const target = new URL(request.url());
      if (target.hostname === 'shikimori.io' && target.pathname === '/api/animes' && target.searchParams.has('mylist')) {
        if (request.method() === 'GET') listRequests.push(target.searchParams.get('mylist'));
        return request.respond({ status: 200, contentType: 'application/json', headers: {
          'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type'
        }, body: request.method() === 'OPTIONS' ? '' : JSON.stringify(target.searchParams.get('page') === '2' ? [] : personalFixture) });
      }
      if (request.headers().authorization === 'Bearer isolated-list-test') return request.abort();
      return request.continue();
    };
    page.on('request', personalRequests);
    await page.evaluate(() => {
      Lampa.Storage.set('shikimori_local_experimental_token', 'isolated-list-test');
      Lampa.Storage.set('shikimori_local_auth_user', { id: 1, nickname: 'Isolated test' });
    });
    async function assertCanonicalPosters(selector) {
      await page.waitForFunction(selector => {
        const images = Array.from(document.querySelectorAll('.activity--active ' + selector + ' img'));
        return images.length === 3 && images.every(image => image.complete && image.naturalWidth > 0);
      }, { timeout: 45000 }, selector);
      const sources = await page.$$eval('.activity--active ' + selector + ' img', images => images.map(image => image.src));
      sources.forEach(source => assert.match(source, /\/uploads\/poster\/animes\//));
      assert.deepEqual(await page.$$eval('.activity--active ' + selector + ' .shikimori-local__result', cards => cards.map(card => card.__shikimoriAnime.shikimori_id)), personalFixture.map(anime => anime.id));
    }
    await push('shikimori_local_home');
    await assertCanonicalPosters('[data-row="my_ongoing"]');
    await page.evaluate(() => Lampa.Controller.collectionFocus(document.querySelector('.activity--active [data-row="my_ongoing"] .selector')));
    await screenshot('home-personal-posters');
    checks.push('authenticated home row uses live canonical posters for the screenshot titles, preserving REST order');
    await push('shikimori_local_userlists', { status: 'planned' });
    await assertCanonicalPosters('[data-group="ongoing"]');
    await screenshot('personal-list-posters');
    checks.push('planned-list carousel hydrates real GraphQL posters instead of decoded 404 assets');
    await push('shikimori_local_line', { section: 'userlist', mylist: 'planned', listStatus: 'ongoing' });
    await assertCanonicalPosters('.line-page');
    checks.push('expanded personal list uses canonical posters as well');
    assert.ok(listRequests.includes('planned,watching') && listRequests.includes('planned'));
    await page.evaluate(() => {
      Lampa.Storage.set('shikimori_local_experimental_token', '');
      Lampa.Storage.set('shikimori_local_auth_user', null);
    });
    await push('shikimori_local_home');
    page.off('request', personalRequests);
    await page.setRequestInterception(false);

    await push('shikimori_local_line', { section: 'popular' });
    await waitImages('.line-page');
    checks.push('catalog posters load');

    await push('shikimori_local_search', { query: '52991' });
    await waitImages('.search-page');
    assert.equal(await page.evaluate(() => document.querySelector('.activity--active .shikimori-local__result').__shikimoriAnime.shikimori_id), 52991);
    checks.push('numeric search loads the real title and its poster');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => Lampa.Activity.active().component === 'shikimori_local_line');

    await push('shikimori_local_filter');
    await waitImages('.filter-page');
    checks.push('REST catalog filter posters load');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => Lampa.Activity.active().component === 'shikimori_local_line');

    await push('shikimori_local_userlists');
    await page.waitForFunction(() => document.querySelector('.activity--active .userlists-page')?.innerText.includes('Аккаунт Shikimori'));
    checks.push('unauthorized lists show the current login instructions');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => Lampa.Activity.active().component === 'shikimori_local_line');

    await push('shikimori_local_anime', { anime: original });
    await waitImages('.anime-detail');
    checks.push('detail poster loads despite broken saved mapping');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => Lampa.Activity.active().component === 'shikimori_local_line');
    checks.push('Back returns from detail to catalog');

    await page.evaluate(() => { Lampa.Controller.toggle('settings'); Lampa.Settings.create('shikilamp_local_settings'); });
    await waitController('settings_component');
    const settings = await page.evaluate(() => ({
      names: Object.values(Lampa.SettingsApi.allComponents()).map(item => item.name),
      groups: Array.from(document.querySelectorAll('.settings-param-title')).map(item => item.innerText),
      count: document.querySelectorAll('.settings .settings-param').length
    }));
    assert.ok(settings.names.includes('ShikiLamp') && !settings.names.some(name => /ShikiLamp (Local|Developer)/.test(name)));
    assert.deepEqual(settings.groups, ['Аккаунт', 'Каталог и интерфейс', 'Данные и помощь']);
    assert.equal(settings.count, 11);
    await screenshot('settings');
    await focusSetting('shikimori_local_action_mappings');
    await screenshot('settings-maintenance');
    await focusSetting('shikimori_local_action_account');
    checks.push('one native settings section, three groups, eleven controls');

    await page.keyboard.press('Enter');
    await waitController('select');
    await page.keyboard.press('Escape');
    await waitController('settings_component');
    assert.equal(await page.evaluate(() => document.querySelector('.settings .selector.focus').getAttribute('data-name')), 'shikimori_local_action_account');
    checks.push('account menu Back restores settings focus');

    await focusSetting('shikimori_local_action_account');
    await page.keyboard.press('Enter');
    await waitController('select');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.shikilamp-auth');
    await page.keyboard.press('Escape');
    await waitController('settings_component');
    await page.waitForFunction(() => !document.querySelector('.shikilamp-auth'));
    checks.push('OAuth QR opens and Back returns to settings');

    await focusSetting('shikimori_local_enabled');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('.shikimori-local-menu-item'));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.shikimori-local-menu-item').length === 1);
    checks.push('one menu visibility switch removes and restores the plugin button');

    await focusSetting('shikimori_local_page_size');
    await page.keyboard.press('Enter');
    await waitController('select');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await waitController('settings_component');
    const pageSize = await page.evaluate(() => Lampa.Storage.get('shikimori_local_page_size'));
    assert.notEqual(Number(pageSize), 20);
    assert.ok([10, 30, 50].includes(Number(pageSize)));
    assert.equal(await page.$eval('.settings [data-name="shikimori_local_page_size"] .settings-param__value', item => item.innerText), String(pageSize));
    checks.push('native page-size choice updates storage and its visible label');

    await focusSetting('shikimori_local_motion');
    await page.keyboard.press('Enter');
    await waitController('select');
    await page.evaluate(() => Lampa.Controller.collectionFocus(Array.from(document.querySelectorAll('.selectbox .selector')).find(item => item.innerText === 'Без анимаций')));
    await page.keyboard.press('Enter');
    await waitController('settings_component');
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-shiki-motion')), 'off');
    checks.push('native motion choice applies immediately');

    await focusSetting('shikimori_local_action_diagnostics');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => Lampa.Activity.active().component === 'shikimori_local_diagnostics');
    assert.equal(await page.evaluate(() => document.body.classList.contains('settings--open')), false);
    checks.push('diagnostics leaves settings without a lingering overlay');

    // A TV unable to decode/load WebP must use the API's JPEG alternate.
    await page.setRequestInterception(true);
    page.on('request', request => request.resourceType() === 'image' && /shikimori\.io\/.*\.webp(?:\?|$)/.test(request.url()) ? request.abort() : request.continue());
    await page.setCacheEnabled(false);
    await push('shikimori_local_anime', { anime: original });
    await waitImages('.anime-detail');
    const alternate = await page.evaluate(() => Array.from(document.querySelectorAll('.anime-detail')).at(-1).querySelector('img').src);
    assert.match(alternate, /\.jpe?g(?:\?|$)/);
    checks.push('unavailable WebP falls back to live JPEG');
    await screenshot('jpeg-fallback');

    page.removeAllListeners('request');
    page.on('request', request => request.resourceType() === 'image' && request.url().includes('shikimori.io/') ? request.abort() : request.continue());
    // Chrome can reuse already decoded images even with the HTTP cache disabled.
    const failedAnime = Object.assign({}, original);
    const uniqueUrl = source => source + (source.includes('?') ? '&' : '?') + 'image_failure_test=1';
    failedAnime.poster = uniqueUrl(original.poster);
    failedAnime.image = uniqueUrl(original.image);
    failedAnime.poster_fallbacks = original.poster_fallbacks.map(uniqueUrl);
    await push('shikimori_local_anime', { anime: failedAnime });
    await page.waitForFunction(title => {
      const root = document.querySelector('.activity--active .anime-detail');
      return root && root.querySelector('img').style.display === 'none' && root.querySelector('.shikimori-local__poster-fallback').textContent === title;
    }, { timeout: 10000 }, original.title).catch(async error => {
      console.error('Failed-source state:', await page.evaluate(() => {
        const root = document.querySelector('.activity--active .anime-detail');
        const image = root && root.querySelector('img');
        return { active: Lampa.Activity.active().component, root: !!root, src: image && image.src, display: image && image.style.display, fallback: root && root.querySelector('.shikimori-local__poster-fallback')?.textContent, state: image && image.__shikimoriPoster };
      }));
      throw error;
    });
    checks.push('all failed sources leave a readable title placeholder');
    assert.deepEqual(pluginErrors, []);
    console.log(JSON.stringify({ version, checks, pluginErrors, screenshots: output }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
