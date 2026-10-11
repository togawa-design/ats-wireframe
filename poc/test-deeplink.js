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

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#mwCorpNo', corpId);
  await page.fill('#tmpEmpStaffId', userId);
  await page.fill('#empStaffPasswd', password);

  console.log('\n[deeplink] ID/パスワードを入力しました。reCAPTCHA・2段階認証を手動で完了してください。');
  console.log('[deeplink] （もし「ログインに失敗しました」と出たら、そのまま画面上でもう一度ログイン操作をやり直してください）');
  console.log('[deeplink] ログイン完了を自動検知します（最大5分待機）。\n');

  await page.waitForSelector('text=ログアウト', { timeout: 300000 });
  console.log('[deeplink] ログイン検知！ 「応募管理(MIWS・MCB)へ」ボタンをクリックして奥のページへ移動します。');

  // メインメニューの「応募管理(MIWS・MCB)へ」ボタンをクリック（新しいタブで開く可能性があるため popup を監視）
  const [popup] = await Promise.all([
    context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
    page.click('text=応募管理'),
  ]).catch(() => [null]);

  await page.waitForTimeout(2000);
  const innerPage = popup || page;
  await innerPage.waitForLoadState('domcontentloaded').catch(() => {});
  await innerPage.waitForTimeout(1500);

  const innerUrl = innerPage.url();
  console.log('[deeplink] 奥のページURL:', innerUrl);
  await innerPage.screenshot({ path: path.join(__dirname, 'screenshots', '13-inner-page.png'), fullPage: true });

  if (innerUrl === url) {
    console.log('[deeplink] 警告: URLが変わっていません。クリックが効いていない可能性があります。');
  }

  // --- 新規タブ(同一コンテキスト、cookieのみ共有)で、直接この奥のURLにアクセス ---
  const freshTab = await context.newPage();
  await freshTab.goto(innerUrl, { waitUntil: 'domcontentloaded' });
  await freshTab.waitForTimeout(3000); // 非同期切り替えの可能性を考慮し長めに待つ
  await freshTab.screenshot({ path: path.join(__dirname, 'screenshots', '14-deeplink-freshtab.png'), fullPage: true });

  const hasLoginForm = (await freshTab.$('#empStaffPasswd')) !== null;
  const freshTabUrl = freshTab.url();
  console.log('[deeplink] 新規タブでの直接アクセス結果:');
  console.log('[deeplink]   最終URL:', freshTabUrl);
  console.log('[deeplink]   ログインフォーム表示:', hasLoginForm);
  console.log('[deeplink]   (false かつURLが奥のページのままなら → 深いリンクへの直接アクセスは成功)');

  console.log('\n[deeplink] 検証完了。2分待機後に閉じます。');
  await new Promise((r) => setTimeout(r, 120000));
  await browser.close();
})().catch((err) => {
  console.error('[deeplink] ERROR:', err.message);
  process.exit(1);
});
