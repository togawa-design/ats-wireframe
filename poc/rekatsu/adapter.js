const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

module.exports = {
  name: 'Re就活',
  statePath: path.join(ROOT, 'storageState.json'),
  listUrl: fs.existsSync(path.join(ROOT, 'inner-url.txt'))
    ? fs.readFileSync(path.join(ROOT, 'inner-url.txt'), 'utf8').trim()
    : 'https://re-katsu.jp/career/manage/entry/mng_ent_top_r',

  // 注意: Re就活はheadlessモードだとBot対策で403になるため、
  // run-watcher.js を呼ぶ側で headless:false 相当の運用を検討する必要がある
  isLoginPage(url) {
    return url.includes('mng_index.aspx');
  },

  // 注意: これは「求人ごとの応募者数」の集計行レベルの監視であり、
  // 個別応募者単位の検知ではない（応募者一覧へのドリルダウンは未実装のTODO）。
  // 同一求人で同時に複数件応募があっても1件の変化としてしか検知できない点に留意。
  async extract(page) {
    const headerCells = await page.$$eval('th', (ths) => ths.map((th) => th.textContent.replace(/\s+/g, '').trim()));
    const rows = await page.$$eval('tbody tr', (trs, headers) =>
      trs
        .map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.replace(/\s+/g, ' ').trim());
          if (cells.length === 0) return null;
          const record = {};
          headers.forEach((h, i) => {
            if (h) record[h] = cells[i] ?? null;
          });
          return record;
        })
        .filter(Boolean),
      headerCells
    );

    return rows.map((r) => ({
      key: `${r['求人コード']}:${r['応募会員']}`, // 求人コード＋応募会員数の組み合わせで変化を検知
      label: `${r['募集職種'] || ''} 応募${r['応募会員'] || ''}件`,
      ...r,
    }));
  },
};
