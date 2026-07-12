const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const requests = [];
  page.on('request', req => {
    if (req.url().includes('shikimori.io/api/graphql')) {
      requests.push({ url: req.url(), method: req.method() });
    }
  });
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  await page.goto('http://127.0.0.1:8080/test.html');
  await new Promise(r => setTimeout(r, 3000));
  const logs = await page.evaluate(() => {
    return {
      ready: !!window.__shikimori_local_ready,
      menuItem: !!document.querySelector('.shikimori-local-menu-item'),
      text: document.querySelector('.shikimori-local-menu-item .menu__text')?.textContent || ''
    };
  });
  console.log('Browser check:', JSON.stringify(logs));
  console.log('GraphQL requests:', requests.length);
  await browser.close();
})().catch(err => {
  console.error('Puppeteer failed:', err.message);
  process.exit(1);
});
