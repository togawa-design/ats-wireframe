const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const url = 'https://assist.doda.jp/DodaAssistR/System/SelectServiceMode';
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => {
    console.log('[doda:inspect] goto失敗:', e.message);
    return null;
  });
  await page.waitForTimeout(2000);

  console.log('[doda:inspect] status:', resp?.status());
  console.log('[doda:inspect] title:', await page.title());
  console.log('[doda:inspect] url:', page.url());
  await page.screenshot({ path: path.join(outDir, 'doda-01-top.png'), fullPage: true });

  const inputs = await page.$$eval('input, form, button', (els) =>
    els.map((el) => ({
      tag: el.tagName,
      type: el.getAttribute('type'),
      name: el.getAttribute('name'),
      id: el.id,
      placeholder: el.getAttribute('placeholder'),
    }))
  );
  console.log('[doda:inspect] form要素:', JSON.stringify(inputs, null, 2));

  await browser.close();
})().catch((err) => {
  console.error('[doda:inspect] ERROR:', err.message);
  process.exit(1);
});
