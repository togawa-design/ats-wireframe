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

function waitForEnter(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, () => { rl.close(); resolve(); }));
}

(async () => {
  const { url, corpId, userId, password } = loadCreds();
  const userDataDir = path.join(__dirname, 'chrome-profile');

  const context = await chromium.launchPersistentContext(userDataDir, { headless: false });
  const page = context.pages()[0] || (await context.newPage());

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#mwCorpNo', corpId);
  await page.fill('#tmpEmpStaffId', userId);
  await page.fill('#empStaffPasswd', password);

  console.log('\n[login-persistent] ID/パスワードを入力しました。');
  console.log('[login-persistent] reCAPTCHA・(あれば)2段階認証を手動で完了してください。');
  console.log('[login-persistent] ログイン後の画面が表示されたら、このターミナルに戻って Enter を押してください。\n');

  await waitForEnter('ログイン完了後、Enterキーを押してください... ');

  await page.screenshot({ path: path.join(__dirname, 'screenshots', '06-persistent-after-login.png'), fullPage: true });
  console.log('[login-persistent] プロファイルを保存しました:', userDataDir);
  console.log('[login-persistent] ブラウザを閉じます。この後 reuse-persistent.js を実行して、ログインなしで再開できるか確認します。');

  await context.close();
})().catch((err) => {
  console.error('[login-persistent] ERROR:', err.message);
  process.exit(1);
});
