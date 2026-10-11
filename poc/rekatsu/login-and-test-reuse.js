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
  const statePath = path.join(__dirname, 'storageState.json');
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#txtUSERID', userId);
  await page.fill('#PasPASS', password);
  await page.click('#btnLogin');
  await page.waitForTimeout(3000);
  console.log('[rekatsu] ログイン後URL:', page.url());

  // 「応募者管理・メール登録」に遷移
  await page.click('text=応募者管理・メール登録');
  await page.waitForTimeout(2500);
  const innerUrl = page.url();
  console.log('[rekatsu] 応募者管理ページURL:', innerUrl);
  await page.screenshot({ path: path.join(outDir, 'rekatsu-04-applicant-list.png'), fullPage: true });
  fs.writeFileSync(path.join(__dirname, 'inner-url.txt'), innerUrl, 'utf8');

  await context.storageState({ path: statePath });
  console.log('[rekatsu] セッション保存完了');
  await browser.close();

  console.log('[rekatsu] ブラウザを完全に閉じました。3秒待機して別プロセスで再アクセスします。');
  await new Promise((r) => setTimeout(r, 3000));

  const browser2 = await chromium.launch({ headless: false }); // このサイトはheadlessだと403になるためheadedのまま検証
  const context2 = await browser2.newContext({ storageState: statePath });
  const page2 = await context2.newPage();
  await page2.goto(innerUrl, { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(2000);
  await page2.screenshot({ path: path.join(outDir, 'rekatsu-05-crossprocess.png'), fullPage: true });

  console.log('[rekatsu] === 別プロセスでの再アクセス結果 ===');
  console.log('[rekatsu] 最終URL:', page2.url());
  console.log('[rekatsu] title:', await page2.title());
  const hasLoginForm = (await page2.$('#PasPASS')) !== null;
  console.log('[rekatsu] ログインフォーム表示:', hasLoginForm, '(false なら別プロセスでのセッション再利用成功)');

  await browser2.close();
})().catch((err) => {
  console.error('[rekatsu] ERROR:', err.message);
  process.exit(1);
});
