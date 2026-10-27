# ats-wireframe プロジェクトルール

ATS（採用管理システム）の設計ドキュメント（HTML、GitHub Pages で公開）と PoC（`apps/web`: Next.js + Prisma、`apps/rpa-worker`: 媒体 RPA ワーカー）。GCP プロジェクトは `fujiarte-ats`。

## 言語ルール
- ユーザーとのコミュニケーション、コミットメッセージ、コード内コメントは日本語

## 設計ドキュメントの運用
- 設計ドキュメントは全て HTML。変更後は GitHub Pages に反映する（このリポジトリは **Public**。秘密・内部の機微情報を載せない）

## 全社インフラチーム（kanshi）との連携

全社のインフラチームは `/Users/ogawatakuya/projects/kanshi`（kanshi）。`obt-kanshi` プロジェクトで全プロジェクトの設定・コスト・公開面・権限を**読み取り専用**で日次点検し、Slack に通知している。

- **新規の GCP / Firebase プロジェクト、GitHub リポジトリ、Cloudflare 等の作成は、kanshi に依頼する**（標準構成: `kanshi/infra-team-charter.md` §4.2）。自分で作らない
- 共通の監視ルール: `kanshi/monitoring-rules.md`（このリポジトリには複製しない）。対応状況・未達項目は `docs/monitoring.md` に記載する
- 公開エンドポイント・Rules・サービスアカウント・シークレット・スケジュール関数・アラート・バックアップを増減／変更したら、**同じ変更で `docs/monitoring.md` の台帳も更新する**
- 本番の IAM・公開設定・Rules・課金設定の変更は、事前に「何を・なぜ・戻し方」を提示して小川さんの承認を得る。権限付与や組織ポリシーの変更は、小川さんが実行する
- kanshi の日次点検（Slack の `[設定点検]`）で指摘を受けた項目は、対応状況を `docs/monitoring.md` に反映する
- 秘密情報（トークン・鍵・Webhook URL・パスワード）は、CLAUDE.md・md・チャット・コミットに平文で書かない。保管は Secret Manager 等
- バックアップ整備の依頼: `kanshi/handoffs/backup-request.md` §4（Cloud SQL `fujiarte-ats-db` の自動バックアップ・PITR・削除保護。パブリック IP の扱いは、バックアップの後に相談）
