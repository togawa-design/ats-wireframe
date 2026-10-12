const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function loadCreds() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'baitai.txt'), 'utf8');
  const section = raw.split('■DODA\n')[1] || '';
  const url = section.match(/管理画面[：:]\s*(\S+)/)?.[1];
  const userId = section.match(/ID[：:]\s*(\S+)/)?.[1];
  const password = section.match(/PASS[：:]\s*(\S+)/)?.[1];
  if (!url || !userId || !password) {
    throw new Error('baitai.txt からDODAの認証情報を抽出できませんでした');
  }
  return { url, userId, password };
}

(async () => {
  const { url, userId, password } = loadCreds();
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'load' });
  await page.fill('input[type=email], input[name=identifier]', userId).catch(async () => {
    // メールアドレス欄がplaceholder等で識別できない場合、ラベル文脈で探す
    await page.getByLabel('メールアドレス').fill(userId);
  });
  await page.fill('input[type=password]', password);
  await page.click('text=同意してログイン');
  await page.waitForTimeout(4000);

  console.log('[doda] ログイン後URL:', page.url());
  console.log('[doda] title:', await page.title());
  await page.screenshot({ path: path.join(outDir, 'doda-02-after-login.png'), fullPage: true });

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log('[doda] 画面テキスト冒頭:', bodyText.replace(/\s+/g, ' '));

  await browser.close();
})().catch((err) => {
  console.error('[doda] ERROR:', err.message);
  process.exit(1);
});
