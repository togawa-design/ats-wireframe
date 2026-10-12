import { MediaAdapter } from '../watcher-core';

export const mynaviAdapter: MediaAdapter = {
  name: 'マイナビ(新卒)',
  slug: 'mynavi',
  listUrl: 'https://miws.mynavi.jp/recruitmentStatusReportTab/MCAVS010',

  isLoginPage(url) {
    return url.includes('job.mynavi.jp');
  },

  async extract(page) {
    await page.click('text=応募管理', { timeout: 5000 }).catch(() => {});
    await page
      .waitForFunction(() => document.querySelectorAll('table').length > 5, { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(2000);

    const records = await page.evaluate(() => {
      const headerCells = Array.from(document.querySelectorAll('thead th')).map((th) =>
        th.textContent!.replace(/\s+/g, '').trim()
      );
      // Material-UIの自動生成クラス名(jssXXX)は不安定なため使わず、
      // 見出し用テーブル(class名に"list"を含む)以外の<table>を1件=1行とみなす
      const rowTables = Array.from(document.querySelectorAll('table')).filter((t) => !t.className.includes('list'));
      return rowTables.map((table) => {
        const cellTexts = Array.from(table.querySelectorAll('td')).map((td) => td.textContent!.replace(/\s+/g, ' ').trim());
        const record: Record<string, string | null> = {};
        headerCells.forEach((h, i) => {
          if (h) record[h] = cellTexts[i] ?? null;
        });
        return record;
      });
    });

    return records.map((r) => {
      const combined = r['氏名応募者管理ID'] || '';
      const idMatch = combined.match(/[A-Za-z0-9]{6,}/);
      return { key: idMatch ? idMatch[0] : combined, label: combined, ...r };
    });
  },
};
