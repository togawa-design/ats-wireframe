# テスト方針

## 完了の定義

機能を1つ作ったら、以下が揃って初めて「完了」とする。

1. 実装
2. その機能のロジックに対するUT
3. ハッピーパス1本のE2E

## UT（Vitest）

- 対象: Server Actions（`actions.ts`）と `src/lib/` 配下のロジック。コンポーネントのUTは書かない（ROIが低いため、E2Eで実際の描画・挙動を確認する方針）。
- Prisma・Firebase Admin は必ずモックする。実DB・実ネットワークに触らない。
- ファイルはテスト対象と同じディレクトリに `*.test.ts` として co-locate する。
- `vi.mock(...)` は各テストファイルの先頭で直接呼ぶこと。`vitest.setup.ts` などの共有セットアップファイルで登録しても、テストファイルが静的importする時点のモジュール解決には間に合わず、モックが効かない（詳しくは `vitest.setup.ts` のコメント参照）。
- 実行: `npm test`（一度だけ） / `npm run test:watch`（ウォッチ）

## E2E（Playwright）

E2Eは2階層で運用する。

1. **機能ごとのハッピーパス**（`e2e/*.spec.ts`）: 機能を1つ作るたびに1本書く。「ユーザーが実際に辿る一番典型的な流れ」だけを書き、エッジケースの網羅はUT側の責務とする。「完了の定義」に含まれるのはこちら。
2. **シナリオテスト**（`e2e/scenarios/*.spec.ts`）: 複数機能をまたぐ業務フロー（例: 応募者登録→選考ステージ進行→内定→LINE通知）を通しで検証する。機能を1つ作るたびには**書かない**。関連する一連の機能が揃ったタイミングで、そのフロー全体を検証するテストを1本追加する。ステップ数が多く壊れやすいテストになりやすいため、本当に重要な業務フローに絞る。詳細は `e2e/scenarios/README.md` 参照。

どちらも同じ `playwright.config.ts` / `e2e/global-setup.ts` を共用し、ファイルの置き場所だけが違う。
- **認証**: 本物のGoogleログイン画面はPlaywrightで自動操作しない（不安定・非推奨）。代わりにFirebase Auth Emulatorを使い、`e2e/global-setup.ts` が
  1. テスト用StaffをDBに直接作成
  2. Admin SDKでカスタムトークンを発行
  3. エミュレータのREST APIでIDトークンに交換
  4. 本番と同じ `/api/auth/session` にPOSTしてセッションCookieを発行
  という手順でログイン済み状態を作る。バイパスするのは「Googleの画面」だけで、アプリ側の認証ロジック自体は本番同様にテストされる。
- **DB**: 本番のCloud SQL（`fujiarte-ats-db`）は絶対に使わない。`e2e/docker-compose.yml` でローカルPostgresを都度起動し、マイグレーション+シードを流してから実行する。
- 実行: `npm run test:e2e`（Docker起動 → マイグレーション → Firebase Emulator起動 → Playwright実行 → Docker停止、まで一括）

### 実行環境について

- `firebase-tools` は Node >=24.12 を要求する（`package.json` の `engines` 警告が出るが動作はする）。CI/ローカルの実行環境を合わせる場合はNodeのアップグレードを検討する。
- ローカルでDockerが使えない場合、`npx prisma dev` で代替の使い捨てPostgresを起動して動作確認できる（本番運用の構成ではないため、CIでは必ずDocker Composeを使うこと）。

## 今後の課題（未着手）

- CI（GitHub Actions）への組み込み。現状は手元で `npm test` / `npm run test:e2e` を実行する運用。
- カバレッジ閾値は設けていない。まずは「ロジックにUT、画面にE2E」が揃っているかをレビューで見る。
