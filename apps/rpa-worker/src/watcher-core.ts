import { chromium, Page } from 'playwright';
import { pool } from './db';
import { getSecret } from './secrets';

export interface WatcherRecord {
  key: string;
  label?: string;
  [k: string]: unknown;
}

export interface MediaAdapter {
  name: string; // 表示名 (例: 'マイナビ(新卒)')
  slug: string; // DB上の識別子・Secret名の接頭辞 (例: 'mynavi')
  listUrl: string;
  isLoginPage(url: string): boolean;
  extract(page: Page): Promise<WatcherRecord[]>;
}

export interface WatchResult {
  status: 'ok' | 'session_expired' | 'error';
  detail?: string;
  newCount: number;
  totalCount: number;
  newRecords: WatcherRecord[];
}

export async function runWatcher(adapter: MediaAdapter, opts: { headless?: boolean } = {}): Promise<WatchResult> {
  const headless = opts.headless ?? true;
  const runAt = new Date();

  let storageStateJson: string;
  try {
    storageStateJson = await getSecret(`${adapter.slug}-storage-state`);
  } catch (err) {
    return await logAndReturn(adapter, runAt, {
      status: 'error',
      detail: `storageState取得失敗: ${(err as Error).message}`,
      newCount: 0,
      totalCount: 0,
      newRecords: [],
    });
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ storageState: JSON.parse(storageStateJson) });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);

  let current: WatcherRecord[] = [];
  try {
    await page.goto(adapter.listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (adapter.isLoginPage(page.url())) {
      await browser.close();
      return await logAndReturn(adapter, runAt, {
        status: 'session_expired',
        detail: 'ログイン画面にリダイレクトされました',
        newCount: 0,
        totalCount: 0,
        newRecords: [],
      });
    }
    current = await adapter.extract(page);
  } catch (err) {
    await browser.close();
    return await logAndReturn(adapter, runAt, {
      status: 'error',
      detail: (err as Error).message,
      newCount: 0,
      totalCount: 0,
      newRecords: [],
    });
  }
  await browser.close();

  // 前回スナップショットとの差分をDBで検知
  const { rows: previousRows } = await pool.query(
    'SELECT record_key FROM applicant_watch_snapshot WHERE media = $1',
    [adapter.slug]
  );
  const previousKeys = new Set(previousRows.map((r) => r.record_key));
  const newRecords = current.filter((r) => r.key && !previousKeys.has(r.key));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of current) {
      await client.query(
        `INSERT INTO applicant_watch_snapshot (media, record_key, label, data, first_seen_at, last_seen_at)
         VALUES ($1, $2, $3, $4, now(), now())
         ON CONFLICT (media, record_key)
         DO UPDATE SET label = EXCLUDED.label, data = EXCLUDED.data, last_seen_at = now()`,
        [adapter.slug, r.key, r.label || null, JSON.stringify(r)]
      );
    }
    for (const r of newRecords) {
      await client.query(
        'INSERT INTO applicant_watch_new_log (media, record_key, label) VALUES ($1, $2, $3)',
        [adapter.slug, r.key, r.label || null]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return await logAndReturn(adapter, runAt, {
    status: 'ok',
    detail: previousRows.length === 0 ? '初回実行（ベースライン保存）' : undefined,
    newCount: newRecords.length,
    totalCount: current.length,
    newRecords,
  });
}

async function logAndReturn(adapter: MediaAdapter, runAt: Date, result: WatchResult): Promise<WatchResult> {
  await pool.query(
    `INSERT INTO applicant_watch_run_log (media, ran_at, status, detail, new_count, total_count)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [adapter.slug, runAt, result.status, result.detail || null, result.newCount, result.totalCount]
  );
  return result;
}
