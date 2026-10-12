import { test, expect } from "@playwright/test";

test("タグを作成して一覧に表示され、削除できる", async ({ page }) => {
  const tagName = `E2Eテストタグ-${Date.now()}`;

  await page.goto("/masters/tags");
  await expect(page.getByRole("heading", { name: "タグマスター" })).toBeVisible();

  await page.getByLabel("タグ名").fill(tagName);
  await page.getByRole("button", { name: "追加" }).click();

  const row = page.getByRole("row").filter({ hasText: tagName });
  await expect(row).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "削除" }).click();

  await expect(page.getByRole("row").filter({ hasText: tagName })).toHaveCount(0);
});
