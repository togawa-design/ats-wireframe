import { test, expect } from "@playwright/test";

test("応募者を登録して一覧に表示され、削除できる", async ({ page }) => {
  const lastName = "E2E";
  const firstName = `テスト${Date.now()}`;
  const email = `e2e-applicant-${Date.now()}@example.com`;

  await page.goto("/applicants");
  await expect(page.getByRole("heading", { name: "応募者一覧" })).toBeVisible();

  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録" }).click();

  const row = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(row).toBeVisible();
  await expect(row.getByText(email)).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "削除" }).click();

  await expect(
    page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` })
  ).toHaveCount(0);
});
