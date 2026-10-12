const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

module.exports = {
  name: 'キミスカ',
  statePath: path.join(ROOT, 'storageState.json'),
  listUrl: fs.existsSync(path.join(ROOT, 'inner-url.txt'))
    ? fs.readFileSync(path.join(ROOT, 'inner-url.txt'), 'utf8').trim()
    : 'https://gutvwd3534.talent-p.net/Kimisuka/EntryList?kimisukaYear=5',

  isLoginPage(url) {
    // ログイン画面はパスなしのルート
    return /^https:\/\/[^/]+\/?$/.test(url);
  },

  async extract(page) {
    await page.waitForSelector('tbody tr', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000); // 非同期で行が増えていくため少し待つ

    const headerCells = await page.$$eval('th', (ths) => ths.map((th) => th.textContent.replace(/\s+/g, '').trim()));
    const rows = await page.$$eval('tbody tr', (trs, expectedCols) =>
      trs
        .map((tr) => Array.from(tr.querySelectorAll('td')))
        .filter((cells) => cells.length === expectedCols) // ページネーション等の無関係な行(3セル)を除外し、実データ行(9セル)のみ対象にする
        .map((cells) => cells.map((td) => td.textContent.replace(/\s+/g, ' ').trim())),
      headerCells.length
    ).then((rowsOfCells) =>
      rowsOfCells.map((cells) => {
        const record = {};
        headerCells.forEach((h, i) => {
          if (h) record[h] = cells[i] ?? null;
        });
        return record;
      })
    );

    return rows
      .filter((r) => r['ID'])
      .map((r) => ({ key: r['ID'], label: `${r['氏名'] || ''}（${r['大学'] || ''}）`, ...r }));
  },
};
