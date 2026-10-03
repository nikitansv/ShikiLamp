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
        lifecycle: require('./src/components/lifecycle'),
        UserLists: require('./src/components/userlists'),
        Filter: require('./src/components/filter'),
        Search: require('./src/components/search'),
        Anime: require('./src/components/anime'),
        Mapping: require('./src/components/mapping'),
        Mappings: require('./src/components/mappings'),
        Diagnostics: require('./src/components/diagnostics'),
        auth: require('./src/ui/auth'),
        styles: require('./src/ui/styles'),
        motion: require('./src/ui/motion'),
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
      const controllers = {};
      let active = 'content';
      let collection = [];
      function neighbor(direction) {
        const focused = collection.find(el => el.classList.contains('focus'));
        if (!focused) return collection[0];
        const rect = focused.getBoundingClientRect();
        const horizontal = direction === 'left' || direction === 'right';
        const sign = direction === 'left' || direction === 'up' ? -1 : 1;
        return collection.filter(el => el !== focused).map(el => {
          const box = el.getBoundingClientRect();
          const dx = (box.left + box.right - rect.left - rect.right) / 2;
          const dy = (box.top + box.bottom - rect.top - rect.bottom) / 2;
          const along = (horizontal ? dx : dy) * sign;
          const across = Math.abs(horizontal ? dy : dx);
          return { el, along, across };
        }).filter(item => item.along > 1 && (!horizontal || item.across < rect.height / 2))
          .sort((a, b) => (a.along + a.across * 2) - (b.along + b.across * 2))[0]?.el;
      }
      // A spatial navigator fixture; production Lampa provides this global itself.
      window.Navigator = {
        canmove: direction => !!neighbor(direction),
        move: direction => { const next = neighbor(direction); if (next) Lampa.Controller.collectionFocus(next); }
      };
      window.Lampa = {
        Storage: { get: (key, fallback) => key.endsWith('experimental_token') ? 'fixture' : key.endsWith('auth_user') ? { id: 1 } : fallback, set: () => {} },
        Controller: {
          move: direction => { if (controllers[active]?.[direction]) controllers[active][direction](); },
          add: (name, controller) => { controllers[name] = controller; },
          toggle: name => {
            if (controllers[active] && controllers[active].gone) controllers[active].gone(name);
            active = name;
            if (controllers[name] && controllers[name].toggle) controllers[name].toggle();
          },
          enabled: () => ({ name: active }),
          collectionSet: root => {
            window.collectionRoot = root;
            collection = Array.from(root.querySelectorAll('.selector')).filter(el => el.offsetParent !== null);
            window.navigationCollection = collection;
            document.querySelectorAll('.selector.focus').forEach(el => el.classList.remove('focus'));
            root.querySelectorAll('.selector').forEach(el => {
              if (el.bind_events) return;
              el.bind_events = true;
              el.addEventListener('click', () => setTimeout(() => el.dispatchEvent(new Event('hover:enter')), 20));
            });
          },
          collectionFocus: el => {
            document.querySelectorAll('.selector.focus').forEach(item => item.classList.remove('focus'));
            el.dispatchEvent(new Event('hover:focus'));
            el.classList.add('focus');
          }
        },
        Activity: { push: data => window.pushes.push(data) }, Noty: { show: () => {} },
        Network: { quiet: (url, done) => done({ data: { animes: (window.animes || []).map(anime => ({
          id: anime.shikimori_id, name: anime.title, kind: 'tv', score: 8.7,
          airedOn: { date: '2026-09-01', year: 2026 }, poster: { mainUrl: anime.poster }
        })) } }) }
      };
      window.pushes = [];
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
      ['Home', 'UserLists', 'Filter', 'Search', 'Anime', 'Mapping', 'Mappings', 'Diagnostics'].forEach(name => p.lifecycle.attachLifecycle(p[name]));
    });
    await page.setViewport({ width: 1280, height: 720 });
    const navigation = await page.evaluate(async () => {
      const p = window.preview;
      const checks = [];
      const check = (condition, name, detail) => { if (!condition) throw new Error(name + (detail ? ': ' + JSON.stringify(detail) : '')); checks.push(name); };
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const host = document.querySelector('#screen');
      const home = new p.Home();
      home.create(); host.replaceChildren(home.html); home.start();
      check(home.html.firstElementChild.getAnimations().length > 0, 'forward page transition starts');
      check(document.documentElement.scrollWidth <= innerWidth, 'page motion does not create horizontal viewport overflow');
      await wait(60);
      const cards = home.html.querySelectorAll('.shikimori-local__result');
      p.lifecycle.refocus(home, cards[0]);
      Lampa.Controller.move('right'); Lampa.Controller.move('right');
      check(cards[2].classList.contains('focus'), 'directional controller moves through cards');
      p.styles.applyUiSettings({ motion: 'soft' });
      p.lifecycle.refocus(home, cards[8]); await wait(55);
      p.lifecycle.refocus(home, cards[1]); await wait(400);
      check(cards[1].getBoundingClientRect().left >= 0 && cards[1].getBoundingClientRect().right <= innerWidth, 'reversing direction cancels the old scroll destination');
      p.styles.applyUiSettings({ motion: 'soft', cardScale: 115, cardSize: 180 });
      p.lifecycle.refocus(home, cards[8]); await wait(400);
      check(cards[8].getBoundingClientRect().right <= innerWidth - 10, 'maximum card zoom keeps the focus outline inside the rail');
      p.styles.applyUiSettings({ motion: 'normal' });
      for (let i = 2; i < 9; i++) p.lifecycle.refocus(home, cards[i]);
      const target = cards[8];
      const rail = target.parentElement;
      let rect, box, visible;
      for (let attempt = 0; attempt < 60; attempt++) {
        await wait(25);
        rect = target.getBoundingClientRect(); box = rail.getBoundingClientRect();
        visible = rect.left >= box.left + 12 && rect.right <= box.right - 12;
        if (visible) break;
      }
      check(visible && target.classList.contains('focus'), 'rapid focus scroll keeps final card and outline visible', { left: rect.left, right: rect.right, railLeft: box.left, railRight: box.right, scrollLeft: rail.scrollLeft });
      // Let native smooth scrolling settle before recording the Back snapshot.
      await wait(150);
      const root = home.html.firstElementChild;
      const left = rail.scrollLeft;
      const top = root.scrollTop;
      home.pause();
      target.classList.remove('focus');
      const anime = new p.Anime({ anime: window.animes[0] });
      anime.create(); host.replaceChildren(anime.html); anime.start();
      await wait(30);
      home.refocus();
      check(window.collectionRoot === anime.html, 'paused background page cannot steal focus');
      anime.pause(); host.replaceChildren(home.html); home.start();
      const returning = home.html.firstElementChild.getAnimations()[0];
      check(returning && returning.effect.getKeyframes()[0].transform.includes('-18'), 'Back uses reverse page transition');
      await wait(80);
      check(target.classList.contains('focus'), 'Back restores selected card');
      check(Math.abs(rail.scrollLeft - left) < 1 && Math.abs(root.scrollTop - top) < 1,
        'Back preserves vertical and horizontal scroll: ' + JSON.stringify({ left, actualLeft: rail.scrollLeft, top, actualTop: root.scrollTop }));
      p.styles.applyUiSettings({ motion: 'off' });
      p.lifecycle.refocus(home, cards[1]); await wait(40);
      const movedLeft = rail.scrollLeft;
      home.start(); await wait(40);
      check(rail.scrollLeft === movedLeft && home.html.firstElementChild.getAnimations().length === 0, 'retoggling an active page does not restore an old Back snapshot');
      window.pushes = [];
      home.html.querySelector('[data-tab="lists"]').click();
      await wait(60);
      check(window.pushes.length === 1, 'host translated mouse click opens one page');
      p.styles.applyUiSettings({ motion: 'soft' });
      rail.scrollLeft = 0;
      rail.dispatchEvent(new WheelEvent('wheel', { deltaY: 80, cancelable: true, bubbles: true }));
      rail.dispatchEvent(new WheelEvent('wheel', { deltaY: 80, cancelable: true, bubbles: true }));
      await wait(70);
      check(rail.scrollLeft > 0 && rail.scrollLeft < 160, 'wheel has intermediate animation frames');
      await wait(330);
      check(Math.abs(rail.scrollLeft - 160) <= 1, 'rapid wheel events accumulate without lost distance');
      p.lifecycle.refocus(home, cards[cards.length - 1]);
      await wait(400);
      check(cards[cards.length - 1].getBoundingClientRect().bottom <= innerHeight, 'bottom cards remain inside the viewport below the host header');
      p.styles.applyUiSettings({ motion: 'off' });
      rail.scrollLeft = rail.scrollWidth - rail.clientWidth; root.scrollTop = 0;
      rail.dispatchEvent(new WheelEvent('wheel', { deltaY: 80, cancelable: true, bubbles: true }));
      check(root.scrollTop > 0, 'wheel leaves a rail at its boundary: ' + JSON.stringify({ left: rail.scrollLeft, maxLeft: rail.scrollWidth - rail.clientWidth, height: root.scrollHeight, viewport: root.clientHeight }));
      home.pause(); host.replaceChildren(anime.html); anime.start();
      p.styles.applyUiSettings({ motion: 'soft' });
      anime.toggleMenu('status-menu');
      await wait(90);
      const dropdown = anime.html.querySelector('[data-menu="status-menu"]');
      check(dropdown.getAnimations().length > 0 && dropdown.getBoundingClientRect().height > 0, 'dropdown opening is animated');
      check(anime.onBack() && !anime.html.querySelector('.shikimori-local__dropdown.open'), 'Back closes dropdown first');
      check(dropdown.getAnimations().length > 0 && !window.navigationCollection.some(el => dropdown.contains(el)), 'closing dropdown animates but cannot receive directional focus');
      check(anime.html.querySelector('[data-action="toggle-status-menu"]').classList.contains('focus'), 'dropdown returns focus to its button');
      anime.toggleMenu('status-menu'); await wait(360);
      check(dropdown.classList.contains('open') && !dropdown.classList.contains('shiki-closing') && dropdown.getBoundingClientRect().height > 0, 'interrupted dropdown close reopens cleanly');
      anime.onBack(); await wait(360);
      const filter = new p.Filter();
      anime.pause(); filter.create(); host.replaceChildren(filter.html); filter.start();
      await wait(40);
      filter.selectField('kind'); filter.onBack();
      check(filter.html.querySelector('[data-field="kind"]').classList.contains('focus'), 'filter options return to selected field');
      filter.action('apply'); await wait(40);
      check(!filter.html.querySelector('.shikimori-local__filter-panel .focus'), 'hidden filter panel cannot capture focus');
      check(window.collectionRoot === filter.html.querySelector('.shikimori-local__filter-main'), 'hidden filter options excluded from directional navigation');
      check(filter.onBack() && !filter.panelHidden, 'Back restores filter panel');
      Lampa.Controller.toggle('head');
      check(filter.html.classList.contains('host-open'), 'filter yields to host header');
      Lampa.Controller.toggle('content');
      check(!filter.html.classList.contains('host-open'), 'filter returns from host header');
      const modal = p.auth.open({ url: 'https://example.com/authorize' });
      check(filter.html.classList.contains('host-open'), 'filter yields its stacking layer to modal controllers');
      let backCount = 0;
      const back = () => backCount++;
      document.addEventListener('keydown', back);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.removeEventListener('keydown', back);
      await wait(220);
      check(backCount === 0 && !modal.element.isConnected, 'overlay Back does not also close underlying page');
      const closingModal = p.auth.open({ url: 'https://example.com/authorize' });
      closingModal.close();
      p.styles.applyUiSettings({ motion: 'off' });
      check(!closingModal.element.isConnected, 'disabling motion completes modal cleanup instead of leaving a frozen overlay');
      filter.pause(); host.replaceChildren(home.html); home.start();
      check(getComputedStyle(rail).scrollBehavior === 'auto', 'motion off disables smooth scrolling');
      check(home.html.firstElementChild.getAnimations().length === 0, 'motion off disables page transitions');
      p.styles.applyUiSettings({ motion: 'normal' });
      home.pause(); host.replaceChildren(filter.html); filter.start();
      filter.pause(); filter.start(); await wait(240);
      check(filter.html.style.display !== 'none' && !filter.html.classList.contains('shiki-inactive'), 'interrupted filter exit cannot hide the resumed page');
      filter.selectField('kind');
      filter.destroy();
      check(!document.querySelector('.shikimori-filter-activity'), 'destroy removes an animating filter portal');
      p.styles.applyUiSettings({ motion: 'soft' });
      host.replaceChildren(home.html); home.start();
      p.lifecycle.refocus(home, cards[8]); await wait(40);
      home.destroy();
      const stopped = rail.scrollLeft;
      await wait(360);
      check(rail.scrollLeft === stopped && !host.querySelector('.shikimori-local').getAnimations().length, 'destroy cancels pending scroll and page animations');
      anime.destroy();
      const previous = new p.Home(); previous.activity = {};
      let currentActivity = previous;
      Lampa.Activity.own = component => component === currentActivity;
      previous.create(); host.replaceChildren(previous.html); previous.start(); await wait(40);
      const previousTab = previous.html.querySelector('[data-tab="filter"]');
      p.lifecycle.refocus(previous, previousTab); previous.pause();
      const outgoing = new p.Filter(); outgoing.activity = {}; currentActivity = outgoing;
      outgoing.create(); host.replaceChildren(outgoing.html); outgoing.start(); await wait(40);
      Lampa.Activity.backward = () => {
        currentActivity = previous; host.replaceChildren(previous.html); previous.start();
        setTimeout(() => outgoing.destroy(), 200);
      };
      Lampa.Controller.move('back');
      check(outgoing.html.classList.contains('shiki-inactive') && previousTab.classList.contains('focus'), 'Activity Back releases the outgoing filter and restores previous focus immediately');
      await wait(240);
      check(outgoing.html === null && !document.querySelector('.shikimori-filter-activity'), 'host delayed destroy removes the outgoing transition');
      previous.destroy(); delete Lampa.Activity.own; delete Lampa.Activity.backward;
      p.styles.applyUiSettings({});
      return checks;
    });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const reduced = await page.evaluate(() => {
      const el = document.createElement('div'); el.className = 'shikimori-local'; document.body.appendChild(el);
      window.preview.motion.reveal(el);
      const disabled = getComputedStyle(el).animationName === 'none' && el.getAnimations().length === 0 && window.preview.motion.duration() === 0;
      el.remove(); return disabled;
    });
    if (!reduced) errors.push('reduced motion does not disable screen animation');
    await page.emulateMediaFeatures([]);
    for (const width of [1920, 1280, 390]) {
      await page.setViewport({ width, height: width === 390 ? 844 : 1080 });
      for (const name of ['Home', 'UserLists', 'Filter', 'Search', 'Anime', 'Mapping', 'Mappings', 'Diagnostics', 'Auth']) {
        await page.evaluate(name => {
          if (window.current) window.current.destroy();
          document.querySelectorAll('.shikilamp-auth').forEach(el => el.__shikimoriClose(true));
          const p = window.preview;
          if (name === 'Auth') { window.current = null; p.auth.open({ url: 'https://example.com/authorize' }); return; }
          const screen = window.current = new p[name]({ anime: window.animes[0], status: 'planned' });
          screen.create();
          document.querySelector('#screen').replaceChildren(screen.html);
          screen.start();
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
        if (name === 'Anime' || name === 'Auth') {
          const clippedFocus = await page.evaluate(() => {
            const scope = document.querySelector('.shikilamp-auth') || window.current.html;
            const focused = scope.querySelector('.selector.focus');
            const rect = focused && focused.getBoundingClientRect();
            return rect && (rect.top < 0 || rect.bottom > innerHeight + 1) ? { top: rect.top, bottom: rect.bottom, height: innerHeight } : null;
          });
          if (clippedFocus) errors.push(name + ' focus clipped at ' + width + ': ' + JSON.stringify(clippedFocus));
        }
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
    console.log(JSON.stringify({ output, navigation, errors }, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
