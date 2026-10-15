import { test, expect } from "@playwright/test";

test("応募者詳細画面で架電履歴を記録でき、架電状況を変更すると一覧でフィルタ・識別できる", async ({
  page,
}) => {
  const lastName = "E2E";
  const firstName = `架電${Date.now()}`;
  const email = `e2e-calllog-${Date.now()}@example.com`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();

  const row = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: `${lastName} ${firstName}` }).click();

  // FR109: 架電履歴を記録する
  await expect(page.getByRole("heading", { name: `${lastName} ${firstName}` })).toBeVisible();
  await expect(page.getByText("まだ架電履歴はありません")).toBeVisible();

  await page.locator("#called_at").fill("2026-10-15T10:00");
  await page.locator("#result").selectOption("不在");
  await page.locator("#note").fill("再架電予定");
  await page.getByRole("button", { name: "記録を追加" }).click();

  await expect(page.getByText("まだ架電履歴はありません")).toHaveCount(0);
  await expect(page.getByText("再架電予定")).toBeVisible();
  await expect(page.getByText("E2Eテストスタッフ", { exact: true })).toBeVisible();

  // FR110: 要架電フラグを変更すると、応募者一覧で識別バッジ・絞り込みに反映される
  // (クライアントコンポーネントからのサーバーアクション呼び出しのため、次ページへ
  // 遷移する前に更新が確実にサーバーへ反映されるのを待つ)
  await page.getByLabel("架電状況を変更").selectOption("callback_needed");
  await page.waitForLoadState("networkidle");

  await page.goto("/applicants");
  const rowAgain = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(rowAgain.getByText("要架電")).toBeVisible();

  await page.locator("#filter-call_status").selectOption("callback_needed");
  await page.getByRole("button", { name: "絞り込む" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` })
  ).toBeVisible();
});
