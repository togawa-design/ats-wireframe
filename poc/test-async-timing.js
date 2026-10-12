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

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#mwCorpNo', corpId);
  await page.fill('#tmpEmpStaffId', userId);
  await page.fill('#empStaffPasswd', password);

  console.log('\n[timing] ID/パスワードを入力しました。reCAPTCHA・2段階認証を手動で完了してください。');
  console.log('[timing] ログイン完了を自動検知します（最大5分待機）。\n');

  await page.waitForSelector('text=ログアウト', { timeout: 300000 });
  console.log('[timing] ログイン検知！ 同じタブをリロードして、0.5秒刻みで最大10秒間の状態変化を観察します。');

  await page.reload({ waitUntil: 'domcontentloaded' });
  const reloadedAt = Date.now();

  for (let i = 0; i < 20; i++) {
    const elapsed = ((Date.now() - reloadedAt) / 1000).toFixed(1);
    const hasLoginForm = (await page.$('#empStaffPasswd')) !== null;
    const hasLogout = (await page.$('text=ログアウト')) !== null;
    console.log(`[timing] +${elapsed}s ログインフォーム=${hasLoginForm} ログアウトボタン=${hasLogout}`);
    if (!hasLoginForm && hasLogout) {
      console.log(`[timing] → +${elapsed}s の時点でダッシュボード表示を確認できました（非同期切り替え説が有力）`);
      break;
    }
    await sleep(500);
  }

  await page.screenshot({ path: path.join(__dirname, 'screenshots', '12-async-timing-final.png'), fullPage: true });
  console.log('\n[timing] 検証完了。2分待機後に閉じます。');
  await sleep(120000);
  await browser.close();
})().catch((err) => {
  console.error('[timing] ERROR:', err.message);
  process.exit(1);
});
