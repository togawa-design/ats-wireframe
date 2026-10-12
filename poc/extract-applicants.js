const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function extractApplicants(page) {
  return page.evaluate(() => {
    const headerCells = Array.from(document.querySelectorAll('thead th')).map((th) =>
      th.textContent.replace(/\s+/g, '').trim()
    );
    // 見出し用テーブル(class名に"list"を含む)以外の<table>を、1件=1テーブルの応募者行とみなす。
    // Material-UIの自動生成クラス名(jssXXX)はビルド/セッションごとに変わりうるため使わない。
    const rowTables = Array.from(document.querySelectorAll('table')).filter(
      (t) => !t.className.includes('list')
    );
    return rowTables.map((table) => {
      const cells = Array.from(table.querySelectorAll('td'));
      const cellTexts = cells.map((td) => td.textContent.replace(/\s+/g, ' ').trim());
      const record = {};
      headerCells.forEach((h, i) => {
        if (h) record[h] = cellTexts[i] ?? null;
      });
      record.__rawCellCount = cellTexts.length;
      return record;
    });
  });
}

function extractKey(record) {
  // 「氏名応募者管理ID」列に、氏名と応募者管理IDが含まれている想定。IDらしき英数字パターンを抜き出す
  const combined = record['氏名応募者管理ID'] || '';
  const idMatch = combined.match(/[A-Za-z0-9]{6,}/);
  return idMatch ? idMatch[0] : combined; // 見つからなければ列全体をキーとして代用
}

(async () => {
  const statePath = path.join(__dirname, 'storageState.json');
  const innerUrl = fs.readFileSync(path.join(__dirname, 'inner-url.txt'), 'utf8').trim();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: statePath });
  const page = await context.newPage();

  await page.goto(innerUrl, { waitUntil: 'domcontentloaded' });
  await page.click('text=応募管理');
  await page.waitForTimeout(2000);
  await page.waitForFunction(
    () => document.querySelectorAll('table').length > 5,
    { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(2000);

  const records = await extractApplicants(page);
  const withKeys = records.map((r) => ({ key: extractKey(r), ...r }));

  const snapshotPath = path.join(__dirname, 'applicant-snapshot.json');
  fs.writeFileSync(snapshotPath, JSON.stringify(withKeys, null, 2), 'utf8');

  console.log('[extract] 抽出件数:', withKeys.length);
  console.log('[extract] 列名:', Object.keys(withKeys[0] || {}).filter((k) => k !== 'key' && k !== '__rawCellCount'));
  console.log('[extract] キー抽出の例(先頭3件、IDのみ):', withKeys.slice(0, 3).map((r) => r.key));
  console.log('[extract] 保存先(個人情報含む・gitignore対象):', snapshotPath);

  await browser.close();
})().catch((err) => {
  console.error('[extract] ERROR:', err.message);
  process.exit(1);
});
