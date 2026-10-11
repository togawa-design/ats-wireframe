const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isLoggedIn(page) {
  // MIWS画面には #empStaffPasswd は無いので、ログインフォームへのリダイレクトかどうかは
  // URLのホストがjob.mynavi.jp(ログインポータル)に変わっていないか、または
  // 「対象年度」セレクタ等のMIWS固有要素の有無で判定する
  const url = page.url();
  const redirectedToLogin = url.includes('job.mynavi.jp');
  const hasMiwsHeader = (await page.$('text=MIWS')) !== null;
  return { redirectedToLogin, hasMiwsHeader, url };
}

(async () => {
  const statePath = path.join(__dirname, 'storageState.json');
  const innerUrl = fs.readFileSync(path.join(__dirname, 'inner-url.txt'), 'utf8').trim();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: statePath });

  const activePage = await context.newPage();
  const idlePage = await context.newPage();

  await activePage.goto(innerUrl, { waitUntil: 'domcontentloaded' });
  await idlePage.goto(innerUrl, { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  console.log('[keepalive] 開始。activeタブは60秒おきにタブ切り替え操作、idleタブは何も操作しません。');
  console.log('[keepalive] 初期状態 active:', await isLoggedIn(activePage));
  console.log('[keepalive] 初期状態 idle:  ', await isLoggedIn(idlePage));

  const totalMinutes = 15;
  const intervalSec = 60;
  const rounds = Math.floor((totalMinutes * 60) / intervalSec);

  for (let i = 1; i <= rounds; i++) {
    await sleep(intervalSec * 1000);

    // active: 実際の操作として「応募管理」タブ→「採用状況レポート」タブを行き来する
    try {
      await activePage.click('text=応募管理', { timeout: 5000 });
      await activePage.waitForTimeout(800);
      await activePage.click('text=採用状況レポート', { timeout: 5000 });
      await activePage.waitForTimeout(800);
    } catch (e) {
      console.log(`[keepalive] activeタブでのクリック操作に失敗(${e.message.split('\n')[0]})`);
    }

    const activeStatus = await isLoggedIn(activePage);
    console.log(`[keepalive] +${i * intervalSec}s active:`, activeStatus);

    if (activeStatus.redirectedToLogin) {
      console.log('[keepalive] → activeタブがログイン画面にリダイレクトされました。操作し続けても切れることが判明。');
      break;
    }
  }

  // 最後にidleタブの状態を1回だけ確認(それまで一切触っていない)
  await idlePage.bringToFront();
  const idleFinalStatus = await isLoggedIn(idlePage);
  console.log('[keepalive] 最終確認 idle(何もしていない側):', idleFinalStatus);
  await idlePage.screenshot({ path: path.join(__dirname, 'screenshots', '16-idle-final.png'), fullPage: true });
  await activePage.screenshot({ path: path.join(__dirname, 'screenshots', '16-active-final.png'), fullPage: true });

  console.log('\n[keepalive] 検証終了。');
  await browser.close();
})().catch((err) => {
  console.error('[keepalive] ERROR:', err.message);
  process.exit(1);
});
