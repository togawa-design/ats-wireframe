import { test, expect } from "@playwright/test";

test("面接記録を登録して一覧に表示され、削除できる", async ({ page }) => {
  const lastName = "E2E";
  const firstName = `面接${Date.now()}`;
  const email = `e2e-interview-${Date.now()}@example.com`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` })
  ).toBeVisible();

  await page.goto("/interviews");
  await page
    .getByLabel("応募者")
    .selectOption({ label: `${lastName} ${firstName}` });
  await page.getByLabel("面接官").selectOption({ label: "E2Eテストスタッフ" });
  await page.getByLabel("面接日時").fill("2027-01-15T10:00");
  await page.getByLabel("評価(1〜5)").fill("4");
  await page.getByRole("button", { name: "登録" }).click();

  const row = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(row).toBeVisible();
  await expect(row.getByText("4/5")).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "削除" }).click();

  await expect(
    page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` })
  ).toHaveCount(0);
});
