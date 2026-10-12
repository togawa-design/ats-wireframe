const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const statePath = path.join(__dirname, 'storageState.json');
  const innerUrl = fs.readFileSync(path.join(__dirname, 'inner-url.txt'), 'utf8').trim();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: statePath });
  const page = await context.newPage();

  await page.goto(innerUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 「応募管理」タブをクリック
  await page.click('text=応募管理');
  await page.waitForTimeout(2000);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1000);

  console.log('[inspect] 応募管理タブ URL:', page.url());
  await page.screenshot({ path: path.join(__dirname, 'screenshots', '18-applicant-list.png'), fullPage: true });

  // テーブル/リスト構造のヒントを取得(個人情報を含む可能性があるテキスト自体は出さず、構造のみ)
  const structure = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const rows = document.querySelectorAll('tr');
    const lists = document.querySelectorAll('[class*="list"], [class*="row"], [class*="item"]');
    return {
      tableCount: tables.length,
      rowCount: rows.length,
      listLikeElementCount: lists.length,
      bodyClassNames: Array.from(document.body.classList),
      headers: Array.from(document.querySelectorAll('th')).map((th) => th.textContent.trim()).slice(0, 20),
    };
  });
  console.log('[inspect] ページ構造:', JSON.stringify(structure, null, 2));

  await browser.close();
})().catch((err) => {
  console.error('[inspect] ERROR:', err.message);
  process.exit(1);
});
