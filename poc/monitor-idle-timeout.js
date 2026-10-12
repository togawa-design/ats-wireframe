const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function loadCreds() {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'baitai.txt'), 'utf8');
  const url = raw.match(/URL[：:]\s*(\S+)/)?.[1];
  const corpId = raw.match(/企業ID\s*(\S+)/)?.[1];
  const userId = raw.match(/採用担当者ID\s*(\S+)/)?.[1];
  const password = raw.match(/新パスワード\s*(\S+)/)?.[1];
  if (!url || !corpId || !userId || !password) {
    throw new Error('baitai.txt から認証情報を抽出できませんでした');
  }
  return { url, corpId, userId, password };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { url, corpId, userId, password } = loadCreds();
  const userDataDir = path.join(__dirname, 'chrome-profile-monitor');

  const context = await chromium.launchPersistentContext(userDataDir, { headless: false });
  const page = context.pages()[0] || (await context.newPage());

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#mwCorpNo', corpId);
  await page.fill('#tmpEmpStaffId', userId);
  await page.fill('#empStaffPasswd', password);

  console.log('\n[monitor] ID/パスワードを入力しました。reCAPTCHA・2段階認証を手動で完了してください。');
  console.log('[monitor] ログイン完了を自動検知します（最大5分待機）。何も押さなくて大丈夫です。\n');

  await page.waitForSelector('text=ログアウト', { timeout: 300000 });
  const loginDetectedAt = Date.now();
  console.log('[monitor] ログイン検知！ここから経過時間を計測し、30秒おきに同じページをリロードします。');

  let elapsedSec = 0;
  const intervalSec = 30;
  while (true) {
    await sleep(intervalSec * 1000);
    elapsedSec += intervalSec;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const hasLoginForm = (await page.$('#empStaffPasswd')) !== null;
    const now = new Date().toISOString();
    console.log(`[monitor] +${elapsedSec}s (${now}) ログインフォーム表示=${hasLoginForm}`);
    if (hasLoginForm) {
      await page.screenshot({ path: path.join(__dirname, 'screenshots', `08-timeout-at-${elapsedSec}s.png`), fullPage: true });
      console.log(`\n[monitor] ログアウト検知。ログイン検知から約 ${elapsedSec} 秒でセッションが切れました。`);
      break;
    }
    if (elapsedSec >= 600) {
      console.log('\n[monitor] 10分経過してもログイン状態が維持されています。監視を終了します。');
      break;
    }
  }

  await context.close();
})().catch((err) => {
  console.error('[monitor] ERROR:', err.message);
  process.exit(1);
});
