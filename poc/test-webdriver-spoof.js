const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

  // navigator.webdriver を false に偽装するスクリプトを、以降作成する全ページに自動適用
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  console.log('[spoof] このページの navigator.webdriver =', await page.evaluate(() => navigator.webdriver));

  await page.fill('#mwCorpNo', corpId);
  await page.fill('#tmpEmpStaffId', userId);
  await page.fill('#empStaffPasswd', password);

  console.log('\n[spoof] ID/パスワードを入力しました。reCAPTCHA・2段階認証を手動で完了してください。');
  console.log('[spoof] ログイン完了を自動検知します（最大5分待機）。\n');

  await page.waitForSelector('text=ログアウト', { timeout: 300000 });
  console.log('[spoof] ログイン検知！ webdriver偽装済みの新規タブで、即座にアクセスしてみます。');

  // webdriver偽装が効いた状態の「新規タブ」で、すぐにアクセスしてみる
  const testPage = await context.newPage();
  await testPage.goto(url, { waitUntil: 'domcontentloaded' });
  await testPage.waitForTimeout(1000);
  await testPage.screenshot({ path: path.join(__dirname, 'screenshots', '10-webdriver-spoofed.png'), fullPage: true });

  const hasLoginForm = (await testPage.$('#empStaffPasswd')) !== null;
  console.log('[spoof] webdriver偽装済み新規タブでのログインフォーム表示:', hasLoginForm);
  console.log('[spoof] (false ならログインフォームは出ていない = ログイン状態を維持できている)');

  console.log('\n[spoof] このまま2分待機します。手動でも構わないので、元のタブでリンクをクリックするなど試してみてください。');
  await new Promise((r) => setTimeout(r, 120000));
  await browser.close();
})().catch((err) => {
  console.error('[spoof] ERROR:', err.message);
  process.exit(1);
});
