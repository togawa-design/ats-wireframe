const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const endpointFile = path.join(__dirname, 'ws-endpoint.txt');
  if (!fs.existsSync(endpointFile)) {
    throw new Error('ws-endpoint.txt がありません。先に keep-browser-open.js を起動したままにしてください。');
  }
  const wsEndpoint = fs.readFileSync(endpointFile, 'utf8').trim();

  console.log('[connect] 接続先:', wsEndpoint);
  const browser = await chromium.connect(wsEndpoint);

  const contexts = browser.contexts();
  console.log('[connect] 既存コンテキスト数:', contexts.length);
  const context = contexts[0];
  const pages = context.pages();
  console.log('[connect] 既存ページ数:', pages.length);

  // 既存のログイン済みページとは別に、同じ「生きている」コンテキスト内で新規タブを開く
  const page = await context.newPage();
  const targetUrl = 'https://job.mynavi.jp/27/corp/';
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(__dirname, 'screenshots', '05-cdp-same-context-newtab.png'), fullPage: true });

  const hasLoginForm = (await page.$('#empStaffPasswd')) !== null;
  console.log('[connect] 同一コンテキスト内・新規タブ url=', page.url());
  console.log('[connect] title=', await page.title());
  console.log('[connect] ログインフォーム表示=', hasLoginForm);

  await page.close();
  // 注意: browser.close() は呼ばない。connect()で得たbrowserをcloseすると
  // リモート側の実プロセス(keep-browser-open.js側)ごと終了してしまうため、切断のみ行う。
  process.exit(0);
})().catch((err) => {
  console.error('[connect] ERROR:', err.message);
  process.exit(1);
});
