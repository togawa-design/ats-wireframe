const fs = require('fs');
const path = require('path');
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
  const { url } = loadCreds();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`[inspect] navigating to ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(__dirname, 'screenshots', '01-top.png'), fullPage: true });
  console.log('[inspect] saved screenshots/01-top.png');
  console.log('[inspect] page title:', await page.title());
  console.log('[inspect] current url:', page.url());

  const inputs = await page.$$eval('input, button, a', (els) =>
    els.slice(0, 200).map((el) => ({
      tag: el.tagName,
      type: el.getAttribute('type'),
      name: el.getAttribute('name'),
      id: el.id,
      placeholder: el.getAttribute('placeholder'),
      text: (el.textContent || '').trim().slice(0, 40),
      href: el.getAttribute('href'),
    }))
  );
  fs.writeFileSync(path.join(__dirname, 'screenshots', '01-elements.json'), JSON.stringify(inputs, null, 2));
  console.log('[inspect] saved screenshots/01-elements.json (elements found:', inputs.length, ')');

  await browser.close();
})().catch((err) => {
  console.error('[inspect] ERROR:', err.message);
  process.exit(1);
});
