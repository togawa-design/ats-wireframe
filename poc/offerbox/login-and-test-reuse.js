const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function loadCreds() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'baitai.txt'), 'utf8');
  const section = raw.split('【オファーボックス】')[1]?.split('【キャリアチケット')[0] || '';
  const url = section.match(/URL[：:]\s*(\S+)/)?.[1];
  const loginId = section.match(/アドレス[：:]\s*(\S+)/)?.[1];
  const password = section.match(/PW[：:]\s*(\S+)/)?.[1];
  if (!url || !loginId || !password) {
    throw new Error('baitai.txt からOfferBoxの認証情報を抽出できませんでした');
  }
  return { url, loginId, password };
}

(async () => {
  const { url, loginId, password } = loadCreds();
  const statePath = path.join(__dirname, 'storageState.json');
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#form_LOGINID', loginId);
  await page.fill('#form_PASSWORD', password);
  await page.click('#form_submit');
  await page.waitForTimeout(3000);

  console.log('[offerbox] ログイン後URL:', page.url());
  console.log('[offerbox] title:', await page.title());
  await page.screenshot({ path: path.join(outDir, 'offerbox-02-after-login.png'), fullPage: true });

  const innerUrl = page.url();
  fs.writeFileSync(path.join(__dirname, 'inner-url.txt'), innerUrl, 'utf8');
  await context.storageState({ path: statePath });
  console.log('[offerbox] セッション保存完了');
  await browser.close();

  console.log('[offerbox] 3秒待機して別プロセスで再アクセスします。');
  await new Promise((r) => setTimeout(r, 3000));

  const browser2 = await chromium.launch({ headless: true });
  const context2 = await browser2.newContext({ storageState: statePath });
  const page2 = await context2.newPage();
  await page2.goto(innerUrl, { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(2000);
  await page2.screenshot({ path: path.join(outDir, 'offerbox-03-crossprocess.png'), fullPage: true });

  console.log('[offerbox] === 別プロセスでの再アクセス結果 ===');
  console.log('[offerbox] 最終URL:', page2.url());
  const hasLoginForm = (await page2.$('#form_PASSWORD')) !== null;
  console.log('[offerbox] ログインフォーム表示:', hasLoginForm, '(false なら成功)');

  await browser2.close();
})().catch((err) => {
  console.error('[offerbox] ERROR:', err.message);
  process.exit(1);
});
