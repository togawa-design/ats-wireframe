const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const url = 'https://re-katsu.jp/career/manage/mng_index.aspx?comid=Z6WjigDWrVM83N744EZjUw%3d%3d';
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('[rekatsu:inspect] navigating to', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(outDir, 'rekatsu-01-top.png'), fullPage: true });
  console.log('[rekatsu:inspect] title:', await page.title());
  console.log('[rekatsu:inspect] url:', page.url());

  const inputs = await page.$$eval('input, button', (els) =>
    els.slice(0, 100).map((el) => ({
      tag: el.tagName,
      type: el.getAttribute('type'),
      name: el.getAttribute('name'),
      id: el.id,
      placeholder: el.getAttribute('placeholder'),
    }))
  );
  console.log('[rekatsu:inspect] form要素:', JSON.stringify(inputs, null, 2));

  await browser.close();
})().catch((err) => {
  console.error('[rekatsu:inspect] ERROR:', err.message);
  process.exit(1);
});
