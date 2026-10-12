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

(async () => {
  const { url, corpId, userId, password } = loadCreds();
  const statePath = path.join(__dirname, 'storageState.json');
  const innerUrlFile = path.join(__dirname, 'inner-url.txt');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#mwCorpNo', corpId);
  await page.fill('#tmpEmpStaffId', userId);
  await page.fill('#empStaffPasswd', password);

  console.log('\n[cross] ID/パスワードを入力しました。reCAPTCHA・2段階認証を手動で完了してください。');
  console.log('[cross] （「ログインに失敗しました」と出たら、そのまま画面上でもう一度ログイン操作をやり直してください）');
  console.log('[cross] ログイン完了を自動検知します（最大5分待機）。\n');

  await page.waitForSelector('text=ログアウト', { timeout: 300000 });
  console.log('[cross] ログイン検知！ 「応募管理」ボタンをクリックして奥のページへ移動します。');

  const [popup] = await Promise.all([
    context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
    page.click('text=応募管理'),
  ]).catch(() => [null]);

  await page.waitForTimeout(2000);
  const innerPage = popup || page;
  await innerPage.waitForLoadState('domcontentloaded').catch(() => {});
  await innerPage.waitForTimeout(1500);

  const innerUrl = innerPage.url();
  console.log('[cross] 奥のページURL:', innerUrl);
  fs.writeFileSync(innerUrlFile, innerUrl, 'utf8');

  // このコンテキストのCookieを保存
  await context.storageState({ path: statePath });
  console.log('[cross] セッションを保存しました:', statePath);

  await browser.close();
  console.log('[cross] ブラウザを完全に閉じました。3秒待機します。');
  await new Promise((r) => setTimeout(r, 3000));

  // --- 完全に新しいブラウザプロセスで、保存したCookieを使い、奥のURLに直接アクセス ---
  const browser2 = await chromium.launch({ headless: false });
  const context2 = await browser2.newContext({ storageState: statePath });
  const page2 = await context2.newPage();
  await page2.goto(innerUrl, { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(2000);
  await page2.screenshot({ path: path.join(__dirname, 'screenshots', '15-crossprocess-deeplink.png'), fullPage: true });

  const hasLoginForm = (await page2.$('#empStaffPasswd')) !== null;
  console.log('[cross] === 新規ブラウザプロセスでの直接アクセス結果 ===');
  console.log('[cross] 最終URL:', page2.url());
  console.log('[cross] ログインフォーム表示:', hasLoginForm);
  console.log('[cross] (false なら → 別プロセスでのCookie使い回しが成功！)');

  await browser2.close();
})().catch((err) => {
  console.error('[cross] ERROR:', err.message);
  process.exit(1);
});
