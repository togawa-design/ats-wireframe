const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const url = 'https://tenshoku.mynavi.jp/client/';
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => {
    console.log('[tenshoku:inspect] goto失敗:', e.message);
    return null;
  });
  await page.waitForTimeout(2000);

  console.log('[tenshoku:inspect] status:', resp?.status());
  console.log('[tenshoku:inspect] title:', await page.title());
  console.log('[tenshoku:inspect] url:', page.url());
  await page.screenshot({ path: path.join(outDir, 'tenshoku-01-top.png'), fullPage: true });

  const inputs = await page.$$eval('input, form, button', (els) =>
    els.map((el) => ({
      tag: el.tagName,
      type: el.getAttribute('type'),
      name: el.getAttribute('name'),
      id: el.id,
      placeholder: el.getAttribute('placeholder'),
    }))
  );
  console.log('[tenshoku:inspect] form要素:', JSON.stringify(inputs, null, 2));

  await browser.close();
})().catch((err) => {
  console.error('[tenshoku:inspect] ERROR:', err.message);
  process.exit(1);
});
