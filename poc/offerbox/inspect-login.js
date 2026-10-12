const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const url = 'https://app.offerbox.jp/clogin/';
  const outDir = path.join(__dirname, '..', 'screenshots');

  for (const headless of [true, false]) {
    const browser = await chromium.launch({ headless });
    const page = await browser.newPage();
    let status = null;
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      status = resp.status();
    } catch (e) {
      console.log(`[offerbox:inspect] headless=${headless} goto失敗:`, e.message);
    }
    await page.waitForTimeout(1500);
    console.log(`[offerbox:inspect] headless=${headless} status=${status} title="${await page.title()}"`);
    await page.screenshot({ path: path.join(outDir, `offerbox-01-headless${headless}.png`), fullPage: true });
    await browser.close();
  }
})().catch((err) => {
  console.error('[offerbox:inspect] ERROR:', err.message);
  process.exit(1);
});
