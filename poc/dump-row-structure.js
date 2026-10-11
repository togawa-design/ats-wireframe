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
  await page.click('text=応募管理');
  await page.waitForTimeout(2500);

  // 個人情報を含むため、コンソールには出さずローカルファイルにのみ保存する
  const html = await page.content();
  fs.writeFileSync(path.join(__dirname, 'applicant-list-raw.html'), html, 'utf8');
  console.log('[dump] HTMLを保存しました(個人情報を含むためgitignore対象): poc/applicant-list-raw.html');

  // 構造把握用に、クラス名だけの骨格(テキストは除去)を別途保存
  const skeleton = await page.evaluate(() => {
    function strip(el, depth) {
      if (depth > 14) return null;
      const children = Array.from(el.children).map((c) => strip(c, depth + 1)).filter(Boolean);
      return {
        tag: el.tagName,
        cls: el.className || undefined,
        id: el.id || undefined,
        children: children.length ? children : undefined,
      };
    }
    const main = document.body;
    return strip(main, 0);
  });
  fs.writeFileSync(path.join(__dirname, 'applicant-list-skeleton.json'), JSON.stringify(skeleton, null, 2), 'utf8');
  console.log('[dump] 骨格(テキストなし)を保存しました: poc/applicant-list-skeleton.json');

  await browser.close();
})().catch((err) => {
  console.error('[dump] ERROR:', err.message);
  process.exit(1);
});
