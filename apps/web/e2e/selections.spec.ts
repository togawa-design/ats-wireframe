import { test, expect } from "@playwright/test";

test("応募登録すると選考が自動作成され、ステージ進行・結果変更ができる", async ({ page }) => {
  const lastName = "E2E";
  const firstName = `選考${Date.now()}`;
  const email = `e2e-selection-${Date.now()}@example.com`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` })
  ).toBeVisible();

  await page.goto("/selections");
  const row = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(row).toBeVisible();
  await expect(row.getByText("エントリー")).toBeVisible();

  await row.getByRole("button", { name: "次のステージへ" }).click();
  await expect(row.getByText("書類選考")).toBeVisible();

  await row.locator("select").selectOption("passed");
  await expect(row.locator("select")).toHaveValue("passed");
});
