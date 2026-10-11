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

async function checkLoggedIn(page, label) {
  const hasLoginForm = (await page.$('#empStaffPasswd')) !== null;
  console.log(`[${label}] url=${page.url()} title="${await page.title()}" ログインフォーム表示=${hasLoginForm}`);
  return !hasLoginForm;
}

(async () => {
  const { url, corpId, userId, password } = loadCreds();
  const statePath = path.join(__dirname, 'storageState.json');
  const targetUrl = 'https://job.mynavi.jp/27/corp/';

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#mwCorpNo', corpId);
  await page.fill('#tmpEmpStaffId', userId);
  await page.fill('#empStaffPasswd', password);

  console.log('\n[save-session] ID/パスワードを入力しました。');
  console.log('[save-session] ブラウザ画面で reCAPTCHA(I\'m not a robot)にチェックし、');
  console.log('[save-session] もし2段階認証(SMS/メール等)が出た場合はそれも手動で完了してください。');
  console.log('[save-session] ログイン後の管理画面（応募管理トップ等）が表示されたら、このターミナルに戻って Enter を押してください。\n');

  await waitForEnter('ログイン完了後、Enterキーを押してください... ');

  await page.screenshot({ path: path.join(__dirname, 'screenshots', '02-after-login.png'), fullPage: true });
  await context.storageState({ path: statePath });
  console.log(`[save-session] セッションを保存しました: ${statePath}`);

  // --- 元のログインタブ(コンテキスト)を完全に閉じる。同時アクセスの影響を排除するため ---
  await context.close();
  console.log('[save-session] 元のログインタブを閉じました。2秒待機します。');
  await new Promise((r) => setTimeout(r, 2000));

  // --- 診断1: 元タブを閉じた後、同一ブラウザプロセス内の新規コンテキストでセッション再利用できるか ---
  const context2 = await browser.newContext({ storageState: statePath });
  const page2 = await context2.newPage();
  await page2.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(1500);
  await page2.screenshot({ path: path.join(__dirname, 'screenshots', '03-reuse-same-browser.png'), fullPage: true });
  await checkLoggedIn(page2, '診断1:元タブを閉じた後、同一ブラウザプロセス内の新規コンテキスト');
  await context2.close();

  // --- ブラウザプロセスごと閉じる ---
  await browser.close();
  console.log('[save-session] ブラウザプロセスを閉じました。3秒待機します。');
  await new Promise((r) => setTimeout(r, 3000));

  // --- 診断2: ブラウザプロセスも閉じた後、新しいブラウザプロセスでセッション再利用できるか ---
  const browser2 = await chromium.launch({ headless: false });
  const context3 = await browser2.newContext({ storageState: statePath });
  const page3 = await context3.newPage();
  await page3.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page3.waitForTimeout(1500);
  await page3.screenshot({ path: path.join(__dirname, 'screenshots', '04-reuse-new-browser.png'), fullPage: true });
  await checkLoggedIn(page3, '診断2:ブラウザプロセスも閉じた後、新規ブラウザプロセス');
  await browser2.close();

  console.log('\n[save-session] 診断完了。screenshots/03-*, 04-* を確認してください。');
})().catch((err) => {
  console.error('[save-session] ERROR:', err.message);
  process.exit(1);
});
