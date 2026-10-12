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

async function dumpStorageKeys(page, label) {
  const info = await page.evaluate(() => ({
    sessionStorageKeys: Object.keys(window.sessionStorage),
    localStorageKeys: Object.keys(window.localStorage),
  }));
  console.log(`[storage] ${label} sessionStorageKeys=`, info.sessionStorageKeys, ' localStorageKeys=', info.localStorageKeys);
  return info;
}

(async () => {
  const { url, corpId, userId, password } = loadCreds();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#mwCorpNo', corpId);
  await page.fill('#tmpEmpStaffId', userId);
  await page.fill('#empStaffPasswd', password);

  console.log('\n[storage] ID/パスワードを入力しました。reCAPTCHA・2段階認証を手動で完了してください。');
  console.log('[storage] ログイン完了を自動検知します（最大5分待機）。\n');

  await page.waitForSelector('text=ログアウト', { timeout: 300000 });
  console.log('[storage] ログイン検知！');

  // --- 診断A: ログインタブ自身の sessionStorage/localStorage の中身(キー名のみ) ---
  await dumpStorageKeys(page, '元のログインタブ');

  // --- 診断B: 同じタブのままリロードしても大丈夫か(比較用の再確認) ---
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const sameTabStillOk = (await page.$('#empStaffPasswd')) === null;
  console.log('[storage] 診断B: 同じタブでリロード後もログイン維持=', sameTabStillOk);

  // --- 診断C: 新規タブ(素の状態)でアクセス ---
  const freshTab = await context.newPage();
  await freshTab.goto(url, { waitUntil: 'domcontentloaded' });
  await freshTab.waitForTimeout(1000);
  await dumpStorageKeys(freshTab, '新規タブ(何もコピーせず)');
  const freshTabHasLogin = (await freshTab.$('#empStaffPasswd')) !== null;
  console.log('[storage] 診断C: 新規タブ(素)でログインフォーム表示=', freshTabHasLogin);

  // --- 診断D: 新規タブに、元タブのlocalStorage/sessionStorageをコピーしてからアクセス ---
  const storageData = await page.evaluate(() => ({
    session: Object.entries(window.sessionStorage),
    local: Object.entries(window.localStorage),
  }));

  const freshTab2 = await context.newPage();
  // まず同一オリジンのページを開いてからでないと sessionStorage/localStorage を設定できない
  await freshTab2.goto(url, { waitUntil: 'domcontentloaded' });
  await freshTab2.evaluate((data) => {
    data.session.forEach(([k, v]) => window.sessionStorage.setItem(k, v));
    data.local.forEach(([k, v]) => window.localStorage.setItem(k, v));
  }, storageData);
  await freshTab2.reload({ waitUntil: 'domcontentloaded' });
  await freshTab2.waitForTimeout(1000);
  await freshTab2.screenshot({ path: path.join(__dirname, 'screenshots', '11-storage-copied.png'), fullPage: true });
  const freshTab2HasLogin = (await freshTab2.$('#empStaffPasswd')) !== null;
  console.log('[storage] 診断D: sessionStorage/localStorageをコピーした新規タブでログインフォーム表示=', freshTab2HasLogin);
  console.log('[storage] (false ならコピーで再現成功、true なら別の要因)');

  console.log('\n[storage] 検証完了。2分待機後に閉じます。');
  await new Promise((r) => setTimeout(r, 120000));
  await browser.close();
})().catch((err) => {
  console.error('[storage] ERROR:', err.message);
  process.exit(1);
});
