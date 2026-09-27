// Offline preview of real components with deterministic API fixtures.
const esbuild = require('esbuild');
const puppeteer = require('puppeteer');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function main() {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'shikilamp-menus-'));
  const bundle = esbuild.buildSync({
    stdin: { contents: `
      window.preview = {
        Home: require('./src/components/home'),
        UserLists: require('./src/components/userlists'),
        Filter: require('./src/components/filter'),
        Search: require('./src/components/search'),
        Anime: require('./src/components/anime'),
        Mapping: require('./src/components/mapping'),
        Mappings: require('./src/components/mappings'),
        Diagnostics: require('./src/components/diagnostics'),
        auth: require('./src/ui/auth'),
        styles: require('./src/ui/styles'),
        api: require('./src/api'),
        userApi: require('./src/api/user'),
        matcher: require('./src/mapping/matcher'),
        storage: require('./src/mapping/storage')
      };
    `, resolveDir: path.resolve(__dirname, '..') },
    bundle: true, write: false, platform: 'browser'
  }).outputFiles[0].text;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<html><head><style>html{font:16px Arial}body{margin:0;background:#202324;color:#fff}#screen{padding-top:5em}</style></head><body><main id="screen"></main></body></html>');
    await page.evaluate(() => {
      window.Lampa = {
        Storage: { get: (key, fallback) => key.endsWith('experimental_token') ? 'fixture' : key.endsWith('auth_user') ? { id: 1 } : fallback, set: () => {} },
        Controller: { add: () => {}, toggle: () => {}, enabled: () => ({ name: 'content' }), collectionSet: () => {}, collectionFocus: () => {} },
        Activity: { push: () => {} }, Noty: { show: () => {} },
        Network: { quiet: (url, done) => done({ data: { animes: (window.animes || []).map(anime => ({
          id: anime.shikimori_id, name: anime.title, kind: 'tv', score: 8.7,
          airedOn: { date: '2026-09-01', year: 2026 }, poster: { mainUrl: anime.poster }
        })) } }) }
      };
    });
    await page.addScriptTag({ content: bundle });
    await page.evaluate(() => {
      const p = window.preview;
      p.styles.injectStyles();
      p.matcher.applyBestPoster = anime => Promise.resolve(anime);
      p.matcher.searchTmdb = () => Promise.resolve([]);
      const poster = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="#3d5966"/><circle cx="150" cy="150" r="70" fill="#aac6bf"/><path d="M0 450L150 230L300 450" fill="#203740"/></svg>');
      window.animes = Array.from({ length: 12 }, (_, i) => ({
        shikimori_id: i + 1, title: ['Провожающая в последний путь Фрирен', 'Монолог фармацевта', 'Поднятие уровня в одиночку'][i % 3],
        poster, kind: 'tv', score: 8.7, year: 2026, release_date: '2026-09-01',
        episodes: 12, rate_id: 5, description: 'Описание произведения. Проверка отступов, кнопок и навигации.'
      }));
      p.api.catalog = p.api.search = () => Promise.resolve(window.animes);
      p.userApi.listCurrentAnimeRates = p.userApi.listMyListAnimes = p.userApi.listAllAnimeRates = () => Promise.resolve(window.animes);
      p.storage.list = () => [{ shikimori_id: 1, tmdb_id: 42, tmdb_type: 'tv', tmdb_season: 1, episode_offset: 0 }];
    });
    for (const width of [1920, 1280, 390]) {
      await page.setViewport({ width, height: width === 390 ? 844 : 1080 });
      for (const name of ['Home', 'UserLists', 'Filter', 'Search', 'Anime', 'Mapping', 'Mappings', 'Diagnostics', 'Auth']) {
        await page.evaluate(name => {
          if (window.current) window.current.destroy();
          document.querySelectorAll('.shikilamp-auth').forEach(el => el.remove());
          const p = window.preview;
          if (name === 'Auth') { window.current = null; p.auth.open({ url: 'https://example.com/authorize' }); return; }
          const screen = window.current = new p[name]({ anime: window.animes[0], status: 'planned' });
          screen.create();
          document.querySelector('#screen').replaceChildren(screen.html);
          if (name === 'Home') {
            const row = screen.html.querySelector('[data-row="ongoing"] .shikimori-local__row-items');
            row.innerHTML = '';
            screen.renderSectionItems({ id: 'ongoing' }, row, window.animes);
          }
          if (name === 'Anime') screen.toggleMenu('status-menu');
        }, name);
        await new Promise(resolve => setTimeout(resolve, 200));
        await page.evaluate(() => {
          document.querySelectorAll('.focus').forEach(el => el.classList.remove('focus'));
          const target = document.querySelector('.shikilamp-auth .selector') ||
            document.querySelector('.shikimori-local__filter-field') ||
            document.querySelector('.shikimori-local__dropdown.open .selector') ||
            document.querySelector('.shikimori-local__result') ||
            document.querySelector('.selector');
          if (target) target.classList.add('focus');
        });
        await new Promise(resolve => setTimeout(resolve, 220));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        if (overflow) errors.push(name + ' overflows at ' + width);
        if (name === 'Auth') {
          const clipped = await page.evaluate(() => {
            const panel = document.querySelector('.shikilamp-auth__panel');
            return panel.scrollWidth > panel.clientWidth;
          });
          if (clipped) errors.push('Auth content clipped at ' + width);
        }
        await page.screenshot({ path: path.join(output, name + '-' + width + '.png') });
      }
    }
    console.log(JSON.stringify({ output, errors }, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
