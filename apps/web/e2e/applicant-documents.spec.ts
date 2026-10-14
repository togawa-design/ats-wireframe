import { test, expect } from "@playwright/test";

test("応募者詳細画面で書類の未提出/提出済みを確認し、アップロードできる", async ({ page }) => {
  const lastName = "E2E";
  const firstName = `書類${Date.now()}`;
  const email = `e2e-doc-${Date.now()}@example.com`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();

  const row = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: `${lastName} ${firstName}` }).click();

  await expect(page.getByRole("heading", { name: `${lastName} ${firstName}` })).toBeVisible();
  await expect(page.getByText("未提出")).toHaveCount(2);

  const esRow = page.getByTestId("document-row-resume");
  await esRow
    .locator('input[type="file"]')
    .setInputFiles({ name: "es.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await esRow.getByRole("button", { name: "アップロード" }).click();

  await expect(page.getByText("提出済み")).toBeVisible();
  await expect(page.getByRole("link", { name: "表示・ダウンロード" })).toBeVisible();
});
