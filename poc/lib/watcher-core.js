// 媒体共通の監視コア処理。
//
// 各媒体は poc/<media>/adapter.js で以下を実装し、run() に渡すだけでよい:
//   module.exports = {
//     name: '媒体名',
//     statePath: storageState.jsonのパス,
//     listUrl: 応募者一覧（相当）ページのURL,
//     isLoginPage(url): そのURLがログイン画面かどうかを判定する関数,
//     extract(page): 現在のページから応募者レコード配列を返す非同期関数。
//                    各レコードは必ず一意な `key` フィールドを持つこと。
//   }
//
// 差分検知・スナップショット保存・新着ログ・セッション失効アラートはここで共通化する。

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function run(adapter, { headless = true } = {}) {
  const dataDir = path.dirname(adapter.statePath);
  const snapshotPath = path.join(dataDir, 'snapshot.json');
  const logPath = path.join(dataDir, 'new-applicants-log.jsonl');
  const runAt = new Date().toISOString();

  if (!fs.existsSync(adapter.statePath)) {
    console.error(`[watcher:${adapter.name}] ${runAt} storageState.jsonがありません。先に初回ログインを実行してください。`);
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ storageState: adapter.statePath });
  const page = await context.newPage();
  page.setDefaultTimeout(8000); // 要素が見つからない場合に長時間待たされないようにする

  let current;
  try {
    await page.goto(adapter.listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (adapter.isLoginPage(page.url())) {
      throw new Error('SESSION_EXPIRED');
    }

    current = await adapter.extract(page);
  } catch (err) {
    const reason = err.message === 'SESSION_EXPIRED' ? 'セッション失効（ログイン画面にリダイレクト）' : err.message;
    console.error(`[watcher:${adapter.name}] ${runAt} 取得失敗: ${reason}`);
    console.error(`[watcher:${adapter.name}] → 実運用ではここでSlack等に異常系アラートを出し、人手による再ログインにエスカレーションする`);
    await browser.close();
    process.exitCode = 1;
    return;
  }

  await browser.close();

  const previous = fs.existsSync(snapshotPath) ? JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) : [];
  const previousKeys = new Set(previous.map((r) => r.key));
  const newRecords = current.filter((r) => r.key && !previousKeys.has(r.key));

  if (previous.length === 0) {
    console.log(`[watcher:${adapter.name}] ${runAt} 初回実行のため、今回の${current.length}件をベースラインとして保存（新着検知なし）`);
  } else if (newRecords.length > 0) {
    console.log(`[watcher:${adapter.name}] ${runAt} 新着を${newRecords.length}件検知しました`);
    const lines = newRecords.map((r) => JSON.stringify({ detectedAt: runAt, media: adapter.name, key: r.key, label: r.label }));
    fs.appendFileSync(logPath, lines.join('\n') + '\n', 'utf8');
    console.log(`[watcher:${adapter.name}] → ${logPath} に追記。実運用ではSlack通知＋ATS DB取込を呼び出す`);
  } else {
    console.log(`[watcher:${adapter.name}] ${runAt} 新着なし（現在${current.length}件）`);
  }

  fs.writeFileSync(snapshotPath, JSON.stringify(current, null, 2), 'utf8');
}

module.exports = { run };
