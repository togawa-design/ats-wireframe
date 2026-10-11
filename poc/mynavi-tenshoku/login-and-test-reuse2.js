const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function loadCreds() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'baitai.txt'), 'utf8');
  const section = raw.split('■マイナビ転職（管理本部）\n')[1]?.split('■DODA')[0] || '';
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
  await page.fill('input[name=ap_login_id]', userId);
  await page.fill('input[name=ap_password]', password);
  await page.click('#loginBtn');
  await page.waitForTimeout(3000);

  await page.click('text=応募管理');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2000);

  const innerUrl = page.url();
  console.log('[tenshoku2] 応募管理ページURL:', innerUrl);
  await page.screenshot({ path: path.join(outDir, 'tenshoku-07-entry.png'), fullPage: true });
  fs.writeFileSync(path.join(__dirname, 'inner-url.txt'), innerUrl, 'utf8');

  await context.storageState({ path: statePath });
  console.log('[tenshoku2] セッション保存完了');
  await browser.close();

  console.log('[tenshoku2] 3秒待機して別プロセスで再アクセスします。');
  await new Promise((r) => setTimeout(r, 3000));

  const browser2 = await chromium.launch({ headless: true });
  const context2 = await browser2.newContext({ storageState: statePath });
  const page2 = await context2.newPage();
  await page2.goto(innerUrl, { waitUntil: 'load' });
  await page2.waitForTimeout(2000);
  await page2.screenshot({ path: path.join(outDir, 'tenshoku-08-crossprocess.png'), fullPage: true });

  console.log('[tenshoku2] === 別プロセス・headlessでの再アクセス結果 ===');
  console.log('[tenshoku2] 最終URL:', page2.url());
  console.log('[tenshoku2] title:', await page2.title());
  const hasLoginForm = (await page2.$('input[name=ap_password]')) !== null;
  console.log('[tenshoku2] ログインフォーム表示:', hasLoginForm, '(false なら成功)');

  await browser2.close();
})().catch((err) => {
  console.error('[tenshoku2] ERROR:', err.message);
  process.exit(1);
});
