-- RPAワーカー専用の最小スキーマ。
-- ATS本体のPrismaスキーマが構築された後は、Applicant/Media等の正式テーブルに
-- 統合する想定（このテーブルはそれまでの暫定置き場）。

CREATE TABLE IF NOT EXISTS applicant_watch_snapshot (
  media           TEXT NOT NULL,
  record_key      TEXT NOT NULL,
  label           TEXT,
  data            JSONB NOT NULL,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (media, record_key)
);

CREATE TABLE IF NOT EXISTS applicant_watch_new_log (
  id              BIGSERIAL PRIMARY KEY,
  media           TEXT NOT NULL,
  record_key      TEXT NOT NULL,
  label           TEXT,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applicant_watch_run_log (
  id              BIGSERIAL PRIMARY KEY,
  media           TEXT NOT NULL,
  ran_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL, -- 'ok' | 'session_expired' | 'error'
  detail          TEXT,
  new_count       INT NOT NULL DEFAULT 0,
  total_count     INT NOT NULL DEFAULT 0
);
