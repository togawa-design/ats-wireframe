import { test, expect } from "@playwright/test";

test("監査ログ画面にログインと選考ステータス変更が記録される", async ({ page }) => {
  const lastName = "E2E";
  const firstName = `監査${Date.now()}`;
  const email = `e2e-audit-${Date.now()}@example.com`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` })
  ).toBeVisible();

  await page.goto("/selections");
  await page.getByRole("button", { name: "リスト" }).click();
  const row = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await row.getByRole("button", { name: "次のステージへ" }).click();
  await expect(row.getByText("書類選考")).toBeVisible();

  // ログイン(global-setupでのセッション作成時に記録済み)と、今回のステージ変更の両方が
  // 一覧に表示されることを確認する。
  await page.goto("/masters/audit-logs");
  await expect(page.getByText("監査ログ(FR088)")).toBeVisible();
  await expect(page.getByText("ログイン").first()).toBeVisible();
  await expect(page.getByText("選考ステータス変更").first()).toBeVisible();
});
