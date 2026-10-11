# Git運用ルール

## ブランチ構成

- `main` — 本番相当。pushすると Firebase App Hosting が本番環境へ自動デプロイする想定。
- `develop` — 統合ブランチ。featureブランチの合流先。それ自体に紐づくデプロイ環境は今はない(Git上の統合ブランチとしてのみ使う)。
- `feature/xxx` — 作業ブランチ。`develop` から切る。1作業・1ブランチ。

```
feature/xxx ──PR(squash)──▶ develop ──PR(squash)──▶ main
```

## マージ方式

- `feature/xxx` → `develop`: **Squash merge**。1機能・1作業 = main/develop上の1コミットになるようにする。作業中の細かい「修正」「コメント追加」などの実装途中コミットは残さない。
- `develop` → `main`: **develop側の変更をまとめてSquash merge**。リリースのたびにmainへは1コミットが積まれる。

## ブランチ名

`feature/` 以下は英語の短いスラッグで良い(例: `feature/web-app-step0-step1`, `feature/design-review-fixes`)。コミットメッセージは従来通り日本語の自由記述でよい(Conventional Commitsのような形式は強制しない)。

## 完了の定義との関係

[TESTING.md](apps/web/TESTING.md) の「完了の定義」(実装+UT+ハッピーパスE2E)を満たしてから `develop` へのPRを出す。

## 今後の課題(未着手)

- GitHub上でのbranch protection(main/developへの直push禁止、PR必須化)は未設定。設定する場合は別途対応する。
- CI(GitHub Actions)導入後は、PRのマージ条件に「テストが通ること」を追加する。
