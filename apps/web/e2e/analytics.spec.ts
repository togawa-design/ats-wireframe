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

  // FR102: ファネルの数値から学生一覧へドリルダウンできる
  const entryLink = page.getByRole("link").filter({ hasText: "エントリー" });
  await expect(entryLink.locator("span").nth(1)).not.toHaveText("0");
  await entryLink.click();
  await expect(page).toHaveURL(/\/applicants\?stage_id=/);
  await expect(
    page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` })
  ).toBeVisible();

  // FR103: 集計期間を未来日に絞り込むと、該当する応募者がいなくなりファネル件数が0になる
  await page.goto("/analytics");
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel("開始日").fill(tomorrow);
  await page.getByRole("button", { name: "絞り込む" }).click();
  await expect(
    page.getByRole("link").filter({ hasText: "エントリー" }).locator("span").nth(1)
  ).toHaveText("0");

  await page.goto("/analytics");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "全応募者CSVエクスポート" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^applicants_\d+\.csv$/);
});
