const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function loadCreds() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'baitai.txt'), 'utf8');
  const section = raw.split('■マイナビ転職（管理本部）\n')[1]?.split('■DODA')[0] || '';
  const url = section.match(/管理画面[：:]\s*(\S+)/)?.[1];
  const userId = section.match(/ID[：:]\s*(\S+)/)?.[1];
  const password = section.match(/PASS[：:]\s*(\S+)/)?.[1];
  if (!url || !userId || !password) {
    throw new Error('baitai.txt からマイナビ転職(管理本部)の認証情報を抽出できませんでした');
  }
  return { url, userId, password };
}

(async () => {
  const { url, userId, password } = loadCreds();
  const statePath = path.join(__dirname, 'storageState.json');
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name=ap_login_id]', userId);
  await page.fill('input[name=ap_password]', password);
  await page.click('#loginBtn');
  await page.waitForTimeout(3000);
  console.log('[tenshoku] ログイン後URL:', page.url());

  const [popup] = await Promise.all([
    context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
    page.click('text=応募管理'),
  ]).catch(() => [null]);

  await page.waitForTimeout(2000);
  const innerPage = popup || page;
  await innerPage.waitForLoadState('domcontentloaded').catch(() => {});
  await innerPage.waitForTimeout(1500);

  const innerUrl = innerPage.url();
  console.log('[tenshoku] 応募管理ページURL:', innerUrl);
  await innerPage.screenshot({ path: path.join(outDir, 'tenshoku-05-inner.png'), fullPage: true });
  fs.writeFileSync(path.join(__dirname, 'inner-url.txt'), innerUrl, 'utf8');

  await context.storageState({ path: statePath });
  console.log('[tenshoku] セッション保存完了');
  await browser.close();

  console.log('[tenshoku] 3秒待機して別プロセスで再アクセスします。');
  await new Promise((r) => setTimeout(r, 3000));

  const browser2 = await chromium.launch({ headless: true });
  const context2 = await browser2.newContext({ storageState: statePath });
  const page2 = await context2.newPage();
  await page2.goto(innerUrl, { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(2000);
  await page2.screenshot({ path: path.join(outDir, 'tenshoku-06-crossprocess.png'), fullPage: true });

  console.log('[tenshoku] === 別プロセス・headlessでの再アクセス結果 ===');
  console.log('[tenshoku] 最終URL:', page2.url());
  console.log('[tenshoku] title:', await page2.title());
  const hasLoginForm = (await page2.$('input[name=ap_password]')) !== null;
  console.log('[tenshoku] ログインフォーム表示:', hasLoginForm, '(false なら成功)');

  await browser2.close();
})().catch((err) => {
  console.error('[tenshoku] ERROR:', err.message);
  process.exit(1);
});
