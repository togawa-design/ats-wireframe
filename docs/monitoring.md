# 監視台帳 (ats-wireframe)

最終更新: 2026-10-27
対象: フジアルテATS本体(`apps/web`) + 媒体RPAワーカー(`apps/rpa-worker`)
参照ルール: kanshi 監視共通ルール v0.1 草案(`monitoring-rules.md` §6.1/§8)

このファイルは「何を使っているか／使っていないか」を判定できる状態にすることが目的。
`要確認` はコード/リポジトリからは判断できず、インフラ側(GCPコンソール等)での確認が必要な項目。

---

## 1. プロジェクト一覧

| 項目 | 内容 |
|---|---|
| GCPプロジェクトID | `fujiarte-ats`(`.env.example`に明記。本番/開発の環境分離は**未確認**) |
| E2E専用Firebaseプロジェクト | `fujiarte-ats-e2e`(ローカル/E2E専用、Auth・Storageエミュレータのみ) |
| 請求アカウント | 要確認(kanshi側 `01AAA0-78083D-2FB705` への統合対象か未確認) |
| ラベル(product/env/owner) | 未確認・未設定と思われる |
| リージョン | `asia-northeast1`(Cloud SQLインスタンス名 `fujiarte-ats:asia-northeast1:fujiarte-ats-db` より) |

**差分(ルール2.1との不一致)**: dev/prod環境分離の有無が設定ファイルから読み取れない。単一プロジェクト`fujiarte-ats`のみ使っている場合はルール2.1 MUSTに抵触するため要確認。

## 2. 公開エンドポイント台帳(§2.3)

`apps/web`に認証ミドルウェア(`middleware.ts`)は無く、各ルートが個別に認証チェックを行っている。

| エンドポイント | 公開範囲 | 認証/認可 | 用途 |
|---|---|---|---|
| `/api/webhooks/line` | 公開(必須) | LINE署名検証(`verifyLineSignature`) | LINE Messaging Webhook受信 |
| `/api/line/register` | 公開(必須・LIFF経由) | LIFF IDトークン検証 | 友だち登録とapplicantの紐付け |
| `/api/mypage/me`, `/api/mypage/profile`, `/api/mypage/documents` | 公開(必須・LIFF経由) | `getApplicantFromRequest`(LIFF IDトークン検証、`src/lib/mypage-auth.ts`) | 応募者本人向けマイページAPI |
| `/api/qr/[id]/image` | 公開(認証なし) | なし | QRコード画像配信。IDが推測困難なUUID前提の設計 |
| `/api/qr/[id]` | 公開(認証なし、未調査) | なし想定 | QRスキャン計測用リダイレクト |
| `/api/auth/session` | 準公開 | Firebase IDトークン検証 | 管理画面ログインのセッションCookie発行 |
| `/api/export/applicants`, `/api/export/offers` | 非公開 | `getCurrentStaff`(社内Staffセッション必須) | CSVエクスポート |
| 管理画面全般(`(app)/*`) | 非公開 | 各Server Component/Actionで`getCurrentStaff`/`assertCanManage` | 社内担当者向け |

**Cloud Run `allUsers`公開の有無**: apps/webがCloud RunとFirebase App Hostingのどちらで動くか未確定(`.env.example`に両論併記)。デプロイ方式が確定した時点で台帳化が必要。

## 3. Rules公開範囲台帳(§2.3/§2.4)

- **Firestore**: 未使用。本アプリのデータストアはCloud SQL(PostgreSQL) + Prismaであり、Firestoreは使っていない。
- **Storage Rules**(`apps/web/storage.rules`): クライアントからの読み書きを全面禁止(`allow read, write: if false`)。アップロード/ダウンロードは常にFirebase Admin SDK経由のサーバーサイド処理(`src/lib/firebase/storage.ts`)。`allow read: if true`は存在しない。

## 4. サービスアカウント一覧

要確認(GCPコンソール側)。コードから読み取れる利用箇所:
- `apps/rpa-worker`: Secret Manager(`@google-cloud/secret-manager`)、Cloud SQL Connector(`@google-cloud/cloud-sql-connector`)にアクセスするSAが必要
- `apps/web`: Firebase Admin SDK(本番ではApplication Default Credentials想定、`.env.example`に明記)

サービスアカウントキー(JSON)の発行有無・棚卸しは未実施。

## 5. シークレット一覧(名前・保管先・用途。値は記載しない)

| 名前 | 保管先(本番) | 用途 |
|---|---|---|
| `DATABASE_URL` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Secret Manager想定(`.env.example`) | Cloud SQL接続 |
| `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` | Secret Manager(`apps/rpa-worker/src/secrets.ts`で読み書き実装あり) | LINE Messaging API |
| `LINE_LOGIN_CHANNEL_ID` | 未確認 | マイページLIFF IDトークン検証 |
| `GOOGLE_APPLICATION_CREDENTIALS` | ローカル開発専用。本番はADCのため未使用 | Firebase Admin SDK |
| 媒体RPA用ログイン情報・storageState | Secret Manager(`apps/rpa-worker/src/secrets.ts`で`getSecret`/`setSecret`実装あり) | RPA自動ログインのセッション再利用 |
| Firebase Web設定(`NEXT_PUBLIC_FIREBASE_*`) | 公開値(秘密情報ではない) | クライアント側Firebase初期化 |

ローテーション手順: 未整備(要作成)。

## 6. ログ設計

| 項目 | 現状 |
|---|---|
| 監査ログ(アプリ内蔵) | `AuditLog`テーブルに実装済み(`src/lib/audit-log.ts`、INSERT ONLY)。記録イベント: `login`, `logout`, `export`, `status_change`, `offer`, `acceptance`, `line_send`, `edit_applicant`, `document_export`(`staff_id`, `target_type/id`, `before/after_value`, `ip_address`を記録)。管理画面に一覧表示あり(`/masters/audit-logs`) |
| ルール§3.2のevent命名規則との整合 | 未整合。現状は`AuditAction` enum形式であり、`auth.failed`等のドット区切りevent名には未対応。認証**失敗**・permission-denied自体は現状記録されていない(成功操作が中心) |
| Cloud Audit Logs(データアクセス) | 要確認(有効化状況不明) |
| アクセスログ(4xx/5xx集計) | 未確認・未整備と思われる |
| CI/CDログ | GitHub Actions未導入(`.github/workflows`が存在しない)。デプロイ実施記録なし |

**差分**: 認証失敗・権限拒否イベントの記録が無い(ルール3.2 MUST未達)。

## 7. アラート一覧(§4.2 A1〜A10 実装状況)

| # | 内容 | 状況 |
|---|---|---|
| A1 | 5xx率急増 | 未実装 |
| A2 | 認証失敗急増 | 未実装(そもそも失敗ログ自体が無い) |
| A3 | リクエスト急増 | 未実装 |
| A4 | Uptime | 未実装 |
| A5 | IAM変更検知 | 未実装 |
| A6 | Rulesデプロイ検知 | 未実装 |
| A7 | Secret Manager異常アクセス | 未実装 |
| A8 | Scheduler失敗検知 | 該当ジョブの有無含め要確認 |
| A9 | コスト異常 | 未実装 |
| A10 | `allUsers`新規公開検知 | 未実装 |

現時点でA1〜A10はすべて未実装。中央(kanshi)側の仕組みが整い次第、本プロジェクトを対象に組み込む。

## 8. 使用技術の台帳(§6.1) — 脆弱性発生時に「影響の有無」を即答するための一覧

### 8.1 apps/web(フジアルテATS本体)

| 項目 | 内容 | EOL |
|---|---|---|
| 言語/ランタイム | Node.js(ローカル確認: v22.22.0。本番の固定バージョンは未確認、`package.json`に`engines`指定なし) | Node 22 LTS: 2027-04予定(要最新確認) |
| フレームワーク | Next.js 16.4.0(App Router) | - |
| UI | React 19.3.0 / React DOM 19.3.0 | - |
| 言語処理系 | TypeScript 5.9.3 | - |
| DBアクセス | Prisma 6.19.3 / @prisma/client 6.19.3 | - |
| DB | PostgreSQL(Cloud SQL、バージョン要確認。E2EローカルDockerは`postgres:16-alpine`) | PostgreSQL 16: 2028-11予定 |
| 認証 | Firebase Auth(`firebase` 13.0.0 / `firebase-admin` 14.5.0) | - |
| ストレージ | Firebase Storage | - |
| LINE連携 | `@line/bot-sdk` 11.3.0、`@line/liff` 2.31.2 | - |
| 実行基盤 | Cloud Run または Firebase App Hosting(**未確定**、`.env.example`に両論併記。要確認) | - |
| PHP | **不使用**(リポジトリ全体に`.php`・`composer.json`なし) | - |

### 8.2 apps/rpa-worker(媒体RPAワーカー)

| 項目 | 内容 |
|---|---|
| 言語/ランタイム | Node.js(ベースイメージ由来、固定バージョン要確認) |
| コンテナベースイメージ | `mcr.microsoft.com/playwright:v1.48.0-jammy`(Ubuntu Jammy。Playwright公式イメージにタグ固定済み) |
| フレームワーク | Express 4.21.0 |
| ブラウザ自動化 | Playwright 1.48.0 |
| DB接続 | `pg` 8.13.0 / `@google-cloud/cloud-sql-connector` 1.12.0 |
| シークレット | `@google-cloud/secret-manager` 5.6.0 |
| 実行基盤 | Cloud Run(`.env.example`に明記) |
| PHP | **不使用** |

### 8.3 差分・要対応

- `apps/web`・`apps/rpa-worker`とも本番の正確なNode.jsバージョン固定(Dockerfile/Cloud Run設定での明示)が未確認。EOL判定を速くするため、両方とも`engines.node`の明記とCloud Run側のランタイム設定確認を推奨
- Dependabot未導入(`.github/dependabot.yml`なし)。ルール6 MUST未達
- GitHub Actions自体が未導入のため、CI/CDログという概念がまだ存在しない

## 9. バックアップ/復旧手順(RPO/RTO)

2026-10-27、kanshiからの依頼(`handoffs/backup-request.md` §4)に基づき、`fujiarte-ats-db`(Cloud SQL, `db-f1-micro`, PostgreSQL 16, asia-northeast1)に以下を適用済み:

- 自動バックアップ: 有効(毎日18:00 UTC = JST 03:00開始、7世代保持)
- PITR: 有効(`pointInTimeRecoveryEnabled: true`、トランザクションログ7日保持 → **RPO ≒ 直近7日以内の任意時点**)
- 削除保護: 有効(`deletionProtectionEnabled: true`)

復元テスト: 同日、`fujiarte-ats-db-pitr-test`への point-in-time clone を実施し、接続・テーブル参照が正常に行えることを確認(検証後は削除済み)。ただし本番に実データが無い状態での検証のため、件数一致の確認は`applicant_watch_*`系3テーブルがいずれも0件同士の一致にとどまる。実データ投入後に改めて復元テストを行うことを推奨(RTO未計測)。

パブリックIP(`ipv4Enabled: true`、許可ネットワーク未登録)の扱いは未着手。Cloud SQL Auth Proxy/Connector経由であれば許可ネットワーク登録は不要なため、本番の接続方式確定後に見直す。

**この対応範囲の限界**: 上記のPITR/バックアップで戻せるのは**Cloud SQL(`fujiarte-ats-db`)のデータのみ**。以下は対象外であり、別途対策が必要:
- Firebase Authのユーザー情報(本システムはStaffのログインにFirebase Authを使用)
- Firebase Storage上のファイル(応募書類等)。バケット`fujiarte-ats.firebasestorage.app`のオブジェクトバージョニングは**無効**(2026-10-27確認、`gcloud storage buckets list`の`versioning.enabled`が空)。誤削除・上書きからの復旧手段が現状無い

**削除保護の副作用に関する注意**: 今後、Cloud SQLインスタンスの作り直し・移行・リージョン変更を行う際は、**先に`--no-deletion-protection`で削除保護を外す手順が必要**になる。該当する計画を立てる際はこの一言を計画書に含めること。

### 重要な発見: 本番DBにATS本体のスキーマが存在しない

`fujiarte-ats-db`に接続して確認したところ、存在するテーブルは`applicant_watch_snapshot` / `applicant_watch_new_log` / `applicant_watch_run_log`(`apps/rpa-worker`の応募者ウォッチ機能用)の3つのみで、`apps/web`のPrismaスキーマが定義する`Staff` / `Applicant` / `AuditLog`等のテーブルは**一つも存在しない**。つまり、ATS本体(apps/web)はこの本番Cloud SQLインスタンスに対してまだマイグレーションが実行されておらず、本番稼働しているのはRPAワーカー側の機能のみと考えられる。ATS本体の本番投入タイミングで、改めてこの監視台帳・バックアップ設定の対象に加える必要がある。

## 10. 本ルールとの差分まとめ(未達項目)

| 項目 | 状態 | 優先度の目安 |
|---|---|---|
| dev/prod環境分離 | 未確認(単一プロジェクトの疑い) | 高 |
| サービスアカウント・請求ラベルの棚卸し | 未実施 | 中 |
| Dependabot導入 | 未導入 | 高(§6.1の直接対象) |
| 認証失敗/permission-deniedのログ記録 | 未実装 | 高 |
| A1〜A10アラート | 全て未実装 | kanshi側の基盤整備待ち |
| Cloud SQL PITR/バックアップ | **対応済み(2026-10-27)** | - |
| Firebase Storageのオブジェクトバージョニング | 無効(2026-10-27確認)。応募書類の誤削除・上書きからの復旧手段なし | 高 |
| パブリックIPの扱い(許可ネットワーク/Connector方式) | 未着手 | 中 |
| 本番実行基盤の確定(Cloud Run vs App Hosting) | 未確定 | 中 |
| ATS本体(apps/web)の本番マイグレーション未実施 | 未着手(§9参照) | 本番投入前に要対応 |
| `docs/security/advisories.md`(脆弱性判定ログ) | 未作成 | 本件(PHP脆弱性)を機に次に作成予定 |
