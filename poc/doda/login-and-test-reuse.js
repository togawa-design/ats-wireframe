const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function loadCreds() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'baitai.txt'), 'utf8');
  const section = raw.split('■DODA\n')[1] || '';
  const url = section.match(/管理画面[：:]\s*(\S+)/)?.[1];
  const userId = section.match(/ID[：:]\s*(\S+)/)?.[1];
  const password = section.match(/PASS[：:]\s*(\S+)/)?.[1];
  return { url, userId, password };
}

(async () => {
  const { url, userId, password } = loadCreds();
  const statePath = path.join(__dirname, 'storageState.json');
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'load' });
  await page.fill('input[type=email], input[name=identifier]', userId);
  await page.fill('input[type=password]', password);
  await page.click('text=同意してログイン');
  await page.waitForTimeout(4000);

  const innerUrl = page.url();
  console.log('[doda] ログイン後URL:', innerUrl);
  await page.screenshot({ path: path.join(outDir, 'doda-03-top.png'), fullPage: true });
  fs.writeFileSync(path.join(__dirname, 'inner-url.txt'), innerUrl, 'utf8');

  await context.storageState({ path: statePath });
  console.log('[doda] セッション保存完了');
  await browser.close();

  console.log('[doda] 3秒待機して別プロセスで再アクセスします。');
  await new Promise((r) => setTimeout(r, 3000));

  const browser2 = await chromium.launch({ headless: true });
  const context2 = await browser2.newContext({ storageState: statePath });
  const page2 = await context2.newPage();
  await page2.goto(innerUrl, { waitUntil: 'load' });
  await page2.waitForTimeout(2000);
  await page2.screenshot({ path: path.join(outDir, 'doda-04-crossprocess.png'), fullPage: true });

  console.log('[doda] === 別プロセス・headlessでの再アクセス結果 ===');
  console.log('[doda] 最終URL:', page2.url());
  console.log('[doda] title:', await page2.title());
  const hasLoginForm = (await page2.$('input[type=password]')) !== null;
  console.log('[doda] ログインフォーム表示:', hasLoginForm, '(false なら成功)');

  await browser2.close();
})().catch((err) => {
  console.error('[doda] ERROR:', err.message);
  process.exit(1);
});
