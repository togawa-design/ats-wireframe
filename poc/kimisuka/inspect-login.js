const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const url = 'https://gutvwd3534.talent-p.net/';
  const outDir = path.join(__dirname, '..', 'screenshots');

  for (const headless of [true, false]) {
    const browser = await chromium.launch({ headless });
    const page = await browser.newPage();
    let status = null;
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      status = resp.status();
    } catch (e) {
      console.log(`[kimisuka:inspect] headless=${headless} goto失敗:`, e.message);
    }
    await page.waitForTimeout(1500);
    console.log(`[kimisuka:inspect] headless=${headless} status=${status} title="${await page.title()}" url=${page.url()}`);
    await page.screenshot({ path: path.join(outDir, `kimisuka-01-headless${headless}.png`), fullPage: true });

    if (headless) {
      const inputs = await page.$$eval('input, form, button', (els) =>
        els.map((el) => ({ tag: el.tagName, type: el.getAttribute('type'), name: el.getAttribute('name'), id: el.id, placeholder: el.getAttribute('placeholder') }))
      );
      console.log('[kimisuka:inspect] form要素:', JSON.stringify(inputs, null, 2));
    }
    await browser.close();
  }
})().catch((err) => {
  console.error('[kimisuka:inspect] ERROR:', err.message);
  process.exit(1);
});
