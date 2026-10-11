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

  // launchServer: 他プロセスから chromium.connect(wsEndpoint) で後からアタッチできるようにする
  const browserServer = await chromium.launchServer({ headless: false });
  const wsEndpoint = browserServer.wsEndpoint();
  const endpointFile = path.join(__dirname, 'ws-endpoint.txt');
  fs.writeFileSync(endpointFile, wsEndpoint, 'utf8');
  console.log('[keep-open] wsEndpoint を保存しました:', endpointFile);

  // 自プロセス内でも connect() して、同じサーバーのブラウザにログイン操作を行う
  const browser = await chromium.connect(wsEndpoint);
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.fill('#mwCorpNo', corpId);
  await page.fill('#tmpEmpStaffId', userId);
  await page.fill('#empStaffPasswd', password);

  console.log('\n[keep-open] ID/パスワードを入力しました。');
  console.log('[keep-open] reCAPTCHA・(あれば)2段階認証を手動で完了してください。');
  console.log('[keep-open] ログイン後の画面が表示されたら、このターミナルに戻って Enter を押してください。\n');

  await waitForEnter('ログイン完了後、Enterキーを押してください... ');
  console.log('[keep-open] このターミナルとブラウザはそのまま閉じずに放置してください。');
  console.log('[keep-open] 別プロセスからの接続テストが終わるまで待機します。終了する場合だけ Ctrl+C してください。\n');

  // ブラウザを閉じずに待機し続ける（Ctrl+Cで終了するまで）
  await new Promise(() => {});
})().catch((err) => {
  console.error('[keep-open] ERROR:', err.message);
  process.exit(1);
});
