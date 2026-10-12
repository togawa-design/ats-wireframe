const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function loadCreds() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'baitai.txt'), 'utf8');
  const section = raw.split('【キャリアチケット就職スカウト】')[1]?.split('残る媒体')[0] || '';
  const url = section.match(/URL[：:]\s*(\S+)/)?.[1];
  const lines = section.split('\n').map((l) => l.trim()).filter(Boolean);
  const loginId = lines.find((l) => l.includes('@') && !l.startsWith('URL'));
  const password = section.match(/pass[：:]\s*(\S+)/)?.[1];
  return { url, loginId, password };
}

(async () => {
  const { url, loginId, password } = loadCreds();
  const outDir = path.join(__dirname, '..', 'screenshots');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('careerticket')) {
      console.log('[careerticket] 自ドメインへのエラー応答:', res.status(), res.url());
    }
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[name=email]', loginId);
  await page.fill('input[name=password]', password);

  const codesVisibleBefore = await page.isVisible('input[name="codes.0"]');
  console.log('[careerticket] クリック前、認証コード欄の可視性:', codesVisibleBefore);

  // パスワード欄と同じフォーム内にある、type=submitのボタンを厳密に指定
  const submitBtn = page.locator('form').locator('button[type=submit]').first();
  await submitBtn.click();

  // ナビゲーションではなくSPA内の状態変化を待つ(コード欄が見えるようになるか、エラーメッセージが出るか)
  await page.waitForTimeout(4000);

  const codesVisibleAfter = await page.isVisible('input[name="codes.0"]');
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));

  console.log('[careerticket] クリック後、認証コード欄の可視性:', codesVisibleAfter);
  console.log('[careerticket] 画面テキスト冒頭:', bodyText.replace(/\n+/g, ' / '));
  await page.screenshot({ path: path.join(outDir, 'careerticket-04-clean.png'), fullPage: true });

  await browser.close();
})().catch((err) => {
  console.error('[careerticket] ERROR:', err.message);
  process.exit(1);
});
