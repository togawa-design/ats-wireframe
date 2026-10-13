import { test, expect } from "@playwright/test";

test("分析ページでファネルが表示され、CSVエクスポートができる", async ({ page }) => {
  const lastName = "E2E";
  const firstName = `分析${Date.now()}`;
  const email = `e2e-analytics-${Date.now()}@example.com`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` })
  ).toBeVisible();

  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "分析・レポート" })).toBeVisible();
  await expect(page.getByText("エントリー")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "全応募者CSVエクスポート" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^applicants_\d+\.csv$/);
});
