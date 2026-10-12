const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function loadCreds() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'baitai.txt'), 'utf8');
  const section = raw.split('■マイナビ転職\n')[1]?.split('■マイナビ転職（管理本部）')[0] || '';
  const url = section.match(/管理画面[：:]\s*(\S+)/)?.[1];
  const userId = section.match(/ID[：:]\s*(\S+)/)?.[1];
  const password = section.match(/PASS[：:]\s*(\S+)/)?.[1];
  if (!url || !userId || !password) {
    throw new Error('baitai.txt からマイナビ転職の認証情報を抽出できませんでした');
  }
  return { url, userId, password };
}

(async () => {
  const { url, userId, password } = loadCreds();
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name=ap_login_id]', userId);
  await page.fill('input[name=ap_password]', password);
  await page.click('#loginBtn');
  await page.waitForTimeout(4000);

  console.log('[tenshoku] ログイン後URL:', page.url());
  console.log('[tenshoku] title:', await page.title());
  await page.screenshot({ path: path.join(outDir, 'tenshoku-02-after-login.png'), fullPage: true });

  const stillHasLoginForm = (await page.$('input[name=ap_password]')) !== null;
  console.log('[tenshoku] ログインフォームがまだ表示されている:', stillHasLoginForm);

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('[tenshoku] 画面テキスト冒頭:', bodyText.replace(/\s+/g, ' '));

  await browser.close();
})().catch((err) => {
  console.error('[tenshoku] ERROR:', err.message);
  process.exit(1);
});
