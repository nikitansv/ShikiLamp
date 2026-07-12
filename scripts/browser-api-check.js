const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const responses = [];
  page.on('response', async res => {
    if (res.url().includes('shikimori.io/api/graphql')) {
      try {
        const text = await res.text();
        responses.push({ status: res.status(), body: text.slice(0, 200) });
      } catch (e) {}
    }
  });
  page.on('console', msg => console.log('CONSOLE:', msg.text()));

  await page.goto('http://127.0.0.1:8080/test.html');
  await new Promise(r => setTimeout(r, 3000));

  // Click menu to open home
  await page.evaluate(() => {
    const item = document.querySelector('.shikimori-local-menu-item');
    if (item) item.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Click "Поиск" section
  await page.evaluate(() => {
    const sections = document.querySelectorAll('.shikimori-local__section');
    for (const s of sections) {
      if (s.textContent.includes('Поиск')) { s.click(); return; }
    }
  });
  await new Promise(r => setTimeout(r, 500));

  // Type search query and submit
  await page.evaluate(() => {
    const input = document.querySelector('.shikimori-local__input');
    if (input) { input.value = 'Frieren'; input.dispatchEvent(new Event('change')); }
    const btn = document.querySelector('.shikimori-local__action');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 5000));

  const logs = await page.evaluate(() => {
    return {
      ready: !!window.__shikimori_local_ready,
      menuItem: !!document.querySelector('.shikimori-local-menu-item'),
      results: document.querySelectorAll('.shikimori-local__result').length,
      errors: document.querySelectorAll('.shikimori-local__error').length
    };
  });
  console.log('Browser check:', JSON.stringify(logs));
  console.log('GraphQL responses:', JSON.stringify(responses));
  await browser.close();
})().catch(err => {
  console.error('Puppeteer failed:', err.message);
  process.exit(1);
});
