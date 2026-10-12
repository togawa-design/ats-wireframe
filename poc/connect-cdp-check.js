const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const cdpUrl = 'http://localhost:9222';
  console.log('[cdp-check] connectOverCDP:', cdpUrl);
  const browser = await chromium.connectOverCDP(cdpUrl);

  const contexts = browser.contexts();
  console.log('[cdp-check] コンテキスト数:', contexts.length);
  const context = contexts[0];
  if (!context) throw new Error('コンテキストが見つかりません');

  const pages = context.pages();
  console.log('[cdp-check] 既存ページ数:', pages.length, pages.map((p) => p.url()));

  const existingPage = pages.find((p) => p.url().includes('mynavi'));
  if (existingPage) {
    const bodyText = await existingPage.evaluate(() => document.body.innerText.slice(0, 150));
    console.log('[cdp-check] 既存ページの内容(先頭150文字、ナビゲーションなし):', bodyText.replace(/\n+/g, ' / '));
  } else {
    console.log('[cdp-check] mynaviの既存ページが見つかりませんでした');
  }

  // 同一コンテキスト内に新規タブを開いて、ログインなしでアクセスできるか確認
  const newPage = await context.newPage();
  await newPage.goto('https://job.mynavi.jp/27/corp/', { waitUntil: 'domcontentloaded' });
  await newPage.waitForTimeout(1000);
  await newPage.screenshot({ path: path.join(__dirname, 'screenshots', '09-cdp-newtab.png'), fullPage: true });
  const hasLoginForm = (await newPage.$('#empStaffPasswd')) !== null;
  console.log('[cdp-check] 同一コンテキスト内・新規タブでのログインフォーム表示:', hasLoginForm);
  await newPage.close();

  // browser.close()は呼ばない(リモート側のChromeを終了させないため)
  process.exit(0);
})().catch((err) => {
  console.error('[cdp-check] ERROR:', err.message);
  process.exit(1);
});
