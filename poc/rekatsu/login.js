const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function loadCreds() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'baitai.txt'), 'utf8');
  const section = raw.split('【Re就活】')[1]?.split('【オファーボックス】')[0] || '';
  const url = section.match(/URL[：:]\s*(\S+)/)?.[1];
  const userId = section.match(/ログインID[：:]\s*(\S+)/)?.[1];
  const password = section.match(/ログインPW[：:]\s*(\S+)/)?.[1];
  if (!url || !userId || !password) {
    throw new Error('baitai.txt からRe就活の認証情報を抽出できませんでした');
  }
  return { url, userId, password };
}

(async () => {
  const { url, userId, password } = loadCreds();
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#txtUSERID', userId);
  await page.fill('#PasPASS', password);
  await page.click('#btnLogin');
  await page.waitForTimeout(3000);

  console.log('[rekatsu:login] title:', await page.title());
  console.log('[rekatsu:login] url:', page.url());
  await page.screenshot({ path: path.join(outDir, 'rekatsu-03-after-login.png'), fullPage: true });

  await context.storageState({ path: path.join(__dirname, 'storageState.json') });
  console.log('[rekatsu:login] セッションを保存しました');

  await browser.close();
})().catch((err) => {
  console.error('[rekatsu:login] ERROR:', err.message);
  process.exit(1);
});
