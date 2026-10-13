import { test, expect } from "@playwright/test";

test("選考フローにステージを追加して削除できる", async ({ page }) => {
  const stageName = `E2Eテスト用ステージ${Date.now()}`;

  await page.goto("/masters/selection-flows");
  await expect(page.getByRole("heading", { name: "選考フロー" })).toBeVisible();

  await page.getByLabel("新規ステージ名").fill(stageName);
  await page.getByRole("button", { name: "ステージ追加" }).click();

  const nameInput = page.locator(`input[value="${stageName}"]`);
  await expect(nameInput).toBeVisible();

  const row = page.locator("div.flex.items-center.gap-2", { has: nameInput });
  page.on("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "削除" }).click();

  await expect(page.locator(`input[value="${stageName}"]`)).toHaveCount(0);
});
