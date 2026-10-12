const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function loadCreds() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'baitai.txt'), 'utf8');
  const section = raw.split('【キミスカ】')[1] || '';
  const url = section.match(/https?:\/\/\S+/)?.[0];
  const userId = section.match(/ID\s+(\S+)/)?.[1];
  const password = section.match(/PW\s+(\S+)/)?.[1];
  if (!url || !userId || !password) {
    throw new Error('baitai.txt からキミスカの認証情報を抽出できませんでした');
  }
  return { url, userId, password };
}

(async () => {
  const { url, userId, password } = loadCreds();
  const statePath = path.join(__dirname, 'storageState.json');
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#UserAccount', userId);
  await page.fill('#Password', password);
  await page.click('button[type=submit]');
  await page.waitForTimeout(3000);

  console.log('[kimisuka] ログイン後URL:', page.url());
  console.log('[kimisuka] title:', await page.title());
  await page.screenshot({ path: path.join(outDir, 'kimisuka-02-after-login.png'), fullPage: true });

  const stillHasLoginForm = (await page.$('#Password')) !== null;
  console.log('[kimisuka] ログインフォームがまだ表示されている:', stillHasLoginForm);

  if (stillHasLoginForm) {
    console.log('[kimisuka] ログインに失敗した可能性があります。ここで終了します。');
    await browser.close();
    return;
  }

  const innerUrl = page.url();
  fs.writeFileSync(path.join(__dirname, 'inner-url.txt'), innerUrl, 'utf8');
  await context.storageState({ path: statePath });
  console.log('[kimisuka] セッション保存完了');
  await browser.close();

  console.log('[kimisuka] 3秒待機して別プロセスで再アクセスします。');
  await new Promise((r) => setTimeout(r, 3000));

  const browser2 = await chromium.launch({ headless: true });
  const context2 = await browser2.newContext({ storageState: statePath });
  const page2 = await context2.newPage();
  await page2.goto(innerUrl, { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(2000);
  await page2.screenshot({ path: path.join(outDir, 'kimisuka-03-crossprocess.png'), fullPage: true });

  console.log('[kimisuka] === 別プロセスでの再アクセス結果 ===');
  console.log('[kimisuka] 最終URL:', page2.url());
  const hasLoginForm2 = (await page2.$('#Password')) !== null;
  console.log('[kimisuka] ログインフォーム表示:', hasLoginForm2, '(false なら成功)');

  await browser2.close();
})().catch((err) => {
  console.error('[kimisuka] ERROR:', err.message);
  process.exit(1);
});
