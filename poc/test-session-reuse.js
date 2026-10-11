const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const statePath = path.join(__dirname, 'storageState.json');
  if (!fs.existsSync(statePath)) {
    throw new Error('storageState.json がありません。先に save-session.js を実行してください。');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: statePath });
  const page = await context.newPage();

  const targetUrl = 'https://job.mynavi.jp/27/corp/';
  console.log(`[reuse] navigating to ${targetUrl} (保存済みセッションを使用)`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(__dirname, 'screenshots', '03-session-reuse.png'), fullPage: true });

  const hasLoginForm = await page.$('#empStaffPasswd') !== null;
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 200));

  console.log('[reuse] current url:', page.url());
  console.log('[reuse] page title:', await page.title());
  console.log('[reuse] ログインフォームが表示されている:', hasLoginForm);
  console.log('[reuse] body先頭:', bodyText.replace(/\n+/g, ' / '));

  await browser.close();
})().catch((err) => {
  console.error('[reuse] ERROR:', err.message);
  process.exit(1);
});
