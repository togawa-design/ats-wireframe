import { test, expect } from "@playwright/test";

/**
 * roadmap.html が定義するMVPの完了条件
 * 「採用担当者が『エントリー受付→LINE連携→選考管理→内定通知→承諾確認』を
 *   一通りシステム上で完結できる状態」を、機能をまたいで通しで検証するシナリオテスト。
 *
 * E2Eシード(e2e/seed.ts)のデフォルト選考フローは エントリー/書類選考/1次面接 の
 * 3ステージのみのため、「内定承諾」は最終ステージ到達 + 結果を「合格」に変更することで
 * 代替する(実運用では選考フロー管理画面でoffer/acceptanceのステージまで用意する想定)。
 */
test("採用担当者がエントリー受付からLINE連携・選考進行・内定通知・結果確定までを一気通貫で行える", async ({
  page,
  request,
}) => {
  const lastName = "E2E";
  const firstName = `シナリオ${Date.now()}`;
  const email = `e2e-scenario-${Date.now()}@example.com`;

  // 1. エントリー受付(FR001)
  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();
  const applicantRow = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(applicantRow).toBeVisible();

  // 2. LINE連携(FR030)。実際のLINEログイン(LIFF)はPlaywrightから操作できないため、
  // 他のE2E同様、LIFF側が行うはずの「プロフィール取得→紐付けAPI呼び出し」を
  // このテストが肩代わりする。
  await applicantRow.getByRole("button", { name: "登録リンクを発行" }).click();
  const url = await applicantRow.locator("code").getAttribute("title");
  const token = new URL(url!).searchParams.get("token");
  const registerRes = await request.post("/api/line/register", {
    data: { token, lineUserId: `Ue2escenario${Date.now()}` },
  });
  expect(registerRes.ok()).toBeTruthy();
  await page.reload();
  await expect(applicantRow.getByText("連携済み")).toBeVisible();

  // 3. 選考管理(FR010/011/014): リスト表示でステージを最終ステージまで進める
  await page.goto("/selections");
  await page.getByRole("button", { name: "リスト" }).click();
  const selectionRow = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(selectionRow).toBeVisible();
  await expect(selectionRow.getByText("エントリー")).toBeVisible();
  await selectionRow.getByRole("button", { name: "次のステージへ" }).click();
  await expect(selectionRow.getByText("書類選考")).toBeVisible();
  await selectionRow.getByRole("button", { name: "次のステージへ" }).click();
  await expect(selectionRow.getByText("1次面接")).toBeVisible();

  // 応募者詳細(FR005で追加)の「現在のステージ」にも選考進行が反映されていることを確認する。
  await page.goto("/applicants");
  const applicantRowAgain = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await applicantRowAgain.getByRole("link", { name: `${lastName} ${firstName}` }).click();
  await page.waitForURL(/\/applicants\/.+/);
  await expect(page.getByRole("heading", { name: `${lastName} ${firstName}` })).toBeVisible();
  const currentStageRow = page.getByText("現在のステージ").locator("..");
  await expect(currentStageRow).toContainText("1次面接");

  // 4. 内定通知(FR032): 応募者詳細からこの応募者個人にLINEメッセージを送る。
  // 実際のLINE送信はテスト環境では成功しない(本物のチャネルが無いため)が、
  // 送信操作自体がエラーまで一気通貫で動くことを確認する。
  await expect(page.getByText("LINEメッセージ(FR032)")).toBeVisible();
  await page.getByPlaceholder("メッセージを入力").fill(`${firstName}さん、内定おめでとうございます`);
  await page.getByRole("button", { name: "送信" }).click();
  await expect(page.getByText("LINE_CHANNEL_ACCESS_TOKEN が設定されていません")).toBeVisible();

  // 5. 承諾確認: 選考結果を「合格」に変更する
  await page.goto("/selections");
  await page.getByRole("button", { name: "リスト" }).click();
  await selectionRow.locator("select").selectOption("passed");
  await expect(selectionRow.locator("select")).toHaveValue("passed");

  // 6. 分析(FR050): 基本ファネルに、この応募者が到達したステージが表示される
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "分析・レポート" })).toBeVisible();
  await expect(page.getByText("1次面接")).toBeVisible();
});
