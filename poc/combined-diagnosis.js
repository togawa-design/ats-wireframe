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
const CDP_PORT = 9222;
const readyFile = path.join(__dirname, 'cdp-ready.flag');
const resultsFile = path.join(__dirname, 'timeout-fine-results.json');

(async () => {
  const { url, corpId, userId, password } = loadCreds();
  if (fs.existsSync(readyFile)) fs.unlinkSync(readyFile);

  const browser = await chromium.launch({
    headless: false,
    args: [`--remote-debugging-port=${CDP_PORT}`],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#mwCorpNo', corpId);
  await page.fill('#tmpEmpStaffId', userId);
  await page.fill('#empStaffPasswd', password);

  console.log('\n[combined] ID/パスワードを入力しました。reCAPTCHA・2段階認証を手動で完了してください。');
  console.log('[combined] ログイン完了を自動検知します（最大5分待機）。\n');

  await page.waitForSelector('text=ログアウト', { timeout: 300000 });
  const loginDetectedAt = Date.now();
  console.log(`[combined] ログイン検知！ CDPポート ${CDP_PORT} で待ち受け中です。`);
  console.log('[combined] 今すぐ「接続していいよ」と伝えてください。Claude側から connect-cdp-check.js で接続します。');
  fs.writeFileSync(readyFile, String(loginDetectedAt), 'utf8');

  // 5秒刻みで、別タブ(同一コンテキスト)をリロードしてログイン状態を記録する
  const results = [];
  const checkPoints = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90];
  const monitorPage = await context.newPage();

  for (const t of checkPoints) {
    const waitMs = loginDetectedAt + t * 1000 - Date.now();
    if (waitMs > 0) await sleep(waitMs);
    await monitorPage.goto(url, { waitUntil: 'domcontentloaded' });
    await monitorPage.waitForTimeout(300);
    const hasLoginForm = (await monitorPage.$('#empStaffPasswd')) !== null;
    const actualElapsed = ((Date.now() - loginDetectedAt) / 1000).toFixed(1);
    results.push({ targetSec: t, actualElapsedSec: Number(actualElapsed), hasLoginForm });
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`[combined] +${actualElapsed}s ログインフォーム表示=${hasLoginForm}`);
  }

  console.log('\n[combined] 計測完了。結果は timeout-fine-results.json に保存しました。');
  console.log('[combined] CDPテストがまだなら、このまま2分待機します。終わったらCtrl+Cで終了してください。');
  await sleep(120000);
  await browser.close();
})().catch((err) => {
  console.error('[combined] ERROR:', err.message);
  process.exit(1);
});
