const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

module.exports = {
  name: 'マイナビ転職(中途)',
  statePath: path.join(ROOT, 'storageState.json'),
  // 「応募管理」メニューのリンク先。新卒と同じMIWS系(hr-miws.mynavi.jp)に遷移する
  listUrl: 'https://tenshoku.mynavi.jp/client/entry/index.cfm?chkcd=a483&fuseaction=ctey_listEntrydata_form&tab=',

  isLoginPage(url) {
    return url.includes('tenshoku.mynavi.jp/client/');
  },

  // TODO: 2026-09-10時点ではzhe19アカウントで完全自動ログイン・一覧抽出まで成功していたが、
  // 2026-10-08の再検証では同アカウントで「認証できません」エラーとなり、ログインできなかった。
  // パスワード変更・一時ロック・invisible reCAPTCHAのスコア判定（新卒マイナビと同様の仕組み）等が
  // 考えられる。クライアントへの確認、または間隔を空けた再試行が必要。
  async extract(page) {
    await page.waitForSelector('tbody tr', { timeout: 10000 }).catch(() => {});
    const headerCells = await page.$$eval('th', (ths) => ths.map((th) => th.textContent.replace(/\s+/g, '').trim()));
    const rows = await page.$$eval('tbody tr', (trs, headers) =>
      trs
        .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.replace(/\s+/g, ' ').trim()))
        .filter((cells) => cells.length > 0)
        .map((cells) => {
          const record = {};
          headers.forEach((h, i) => {
            if (h) record[h] = cells[i] ?? null;
          });
          return record;
        }),
      headerCells
    );
    return rows.map((r, i) => ({ key: JSON.stringify(r).slice(0, 50) || String(i), label: '', ...r }));
  },
};
