const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const userDataDir = path.join(__dirname, 'chrome-profile');
  const targetUrl = 'https://job.mynavi.jp/27/corp/';

  const context = await chromium.launchPersistentContext(userDataDir, { headless: false });
  const page = context.pages()[0] || (await context.newPage());

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(__dirname, 'screenshots', '07-persistent-reuse.png'), fullPage: true });

  const hasLoginForm = (await page.$('#empStaffPasswd')) !== null;
  console.log('[reuse-persistent] url=', page.url());
  console.log('[reuse-persistent] title=', await page.title());
  console.log('[reuse-persistent] ログインフォーム表示=', hasLoginForm);

  await context.close();
})().catch((err) => {
  console.error('[reuse-persistent] ERROR:', err.message);
  process.exit(1);
});
