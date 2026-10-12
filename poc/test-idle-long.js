const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const statePath = path.join(__dirname, 'storageState.json');
  const innerUrl = fs.readFileSync(path.join(__dirname, 'inner-url.txt'), 'utf8').trim();
  const totalMinutes = 60;
  const heartbeatMinutes = 5;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: statePath });
  const page = await context.newPage();

  await page.goto(innerUrl, { waitUntil: 'domcontentloaded' });
  console.log(`[idle-long] 開始 ${new Date().toISOString()} / ${totalMinutes}分間、完全に何も操作せず放置します。`);

  const rounds = Math.floor(totalMinutes / heartbeatMinutes);
  for (let i = 1; i <= rounds; i++) {
    await sleep(heartbeatMinutes * 60 * 1000);
    console.log(`[idle-long] 経過 ${i * heartbeatMinutes}分 (${new Date().toISOString()}) ※ページには一切触れていません`);
  }

  console.log('[idle-long] 放置終了。最後に一度だけ reload して状態を確認します。');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const url = page.url();
  const redirectedToLogin = url.includes('job.mynavi.jp');
  const hasMiwsHeader = (await page.$('text=MIWS')) !== null;
  await page.screenshot({ path: path.join(__dirname, 'screenshots', '17-idle-long-final.png'), fullPage: true });

  console.log('[idle-long] === 最終結果 ===');
  console.log('[idle-long] 経過時間:', totalMinutes, '分');
  console.log('[idle-long] 最終URL:', url);
  console.log('[idle-long] ログイン画面にリダイレクト:', redirectedToLogin);
  console.log('[idle-long] MIWSヘッダー表示:', hasMiwsHeader);

  await browser.close();
})().catch((err) => {
  console.error('[idle-long] ERROR:', err.message);
  process.exit(1);
});
