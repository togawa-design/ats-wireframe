import { test, expect } from "@playwright/test";

test("ユーザーを追加し、ロール変更・停止ができる", async ({ page }) => {
  const name = `E2Eスタッフ${Date.now()}`;
  const email = `e2e-staff-new-${Date.now()}@example.com`;

  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "ユーザー管理" })).toBeVisible();

  await page.getByLabel("氏名").fill(name);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("ロール").selectOption("recruiter");
  await page.getByRole("button", { name: "追加", exact: true }).click();

  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row.getByText("有効")).toBeVisible();

  await row.locator("select").selectOption("interviewer");
  await expect(row.locator("select")).toHaveValue("interviewer");

  page.on("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "停止する" }).click();
  await expect(row.getByText("停止中")).toBeVisible();
});
