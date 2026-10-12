// マイナビ2027 応募者一覧の差分監視スクリプト(PoC)
//
// 想定運用: cron等で数分〜十数分おきに実行する。
// 1. 保存済みセッション(storageState.json)で応募者一覧ページにアクセス(ログイン不要)
// 2. 前回実行時のスナップショット(applicant-snapshot.json)と突き合わせ、新規の応募者管理IDを検出
// 3. 新規があれば new-applicants-log.jsonl に追記し、アラートとしてコンソール出力(実運用ではSlack通知等に置き換え)
// 4. 今回の一覧を次回比較用のスナップショットとして保存

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const STATE_PATH = path.join(__dirname, 'storageState.json');
const INNER_URL = fs.readFileSync(path.join(__dirname, 'inner-url.txt'), 'utf8').trim();
const SNAPSHOT_PATH = path.join(__dirname, 'applicant-snapshot.json');
const NEW_LOG_PATH = path.join(__dirname, 'new-applicants-log.jsonl');

function extractKey(record) {
  const combined = record['氏名応募者管理ID'] || '';
  const idMatch = combined.match(/[A-Za-z0-9]{6,}/);
  return idMatch ? idMatch[0] : combined;
}

async function fetchCurrentApplicants() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  await page.goto(INNER_URL, { waitUntil: 'domcontentloaded' });

  // セッション切れ検知: ログイン系ドメインにリダイレクトされていないか
  if (page.url().includes('job.mynavi.jp')) {
    await browser.close();
    throw new Error('SESSION_EXPIRED: ログイン画面にリダイレクトされました。手動での再ログインが必要です。');
  }

  await page.click('text=応募管理');
  await page
    .waitForFunction(() => document.querySelectorAll('table').length > 5, { timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(2000);

  const records = await page.evaluate(() => {
    const headerCells = Array.from(document.querySelectorAll('thead th')).map((th) =>
      th.textContent.replace(/\s+/g, '').trim()
    );
    const rowTables = Array.from(document.querySelectorAll('table')).filter(
      (t) => !t.className.includes('list')
    );
    return rowTables.map((table) => {
      const cellTexts = Array.from(table.querySelectorAll('td')).map((td) =>
        td.textContent.replace(/\s+/g, ' ').trim()
      );
      const record = {};
      headerCells.forEach((h, i) => {
        if (h) record[h] = cellTexts[i] ?? null;
      });
      return record;
    });
  });

  await browser.close();
  return records.map((r) => ({ key: extractKey(r), ...r }));
}

(async () => {
  const runAt = new Date().toISOString();
  let current;
  try {
    current = await fetchCurrentApplicants();
  } catch (err) {
    console.error(`[watcher] ${runAt} 取得失敗: ${err.message}`);
    console.error('[watcher] → 実運用ではここでSlack等に異常系アラートを出し、必要なら手動対応にエスカレーションする');
    process.exit(1);
  }

  const previous = fs.existsSync(SNAPSHOT_PATH)
    ? JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
    : [];
  const previousKeys = new Set(previous.map((r) => r.key));

  const newRecords = current.filter((r) => r.key && !previousKeys.has(r.key));

  if (previous.length === 0) {
    console.log(`[watcher] ${runAt} 初回実行のため、今回の${current.length}件をベースラインとして保存します(新着検知なし)`);
  } else if (newRecords.length > 0) {
    console.log(`[watcher] ${runAt} 新着応募者を${newRecords.length}件検知しました！`);
    const logLines = newRecords.map((r) =>
      JSON.stringify({ detectedAt: runAt, key: r.key, name: r['氏名応募者管理ID'] })
    );
    fs.appendFileSync(NEW_LOG_PATH, logLines.join('\n') + '\n', 'utf8');
    console.log('[watcher] → 新着ログに追記しました:', NEW_LOG_PATH);
    console.log('[watcher] → 実運用ではここでSlack通知＋ATS DBへの取り込み処理を呼び出す');
  } else {
    console.log(`[watcher] ${runAt} 新着なし(現在${current.length}件、前回${previous.length}件)`);
  }

  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(current, null, 2), 'utf8');
})();
