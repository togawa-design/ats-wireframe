import { test, expect } from "@playwright/test";

test("CSVをアップロードすると自動マッピングされ、応募者が一括登録される", async ({ page }) => {
  const mediaName = `E2Eテスト媒体${Date.now()}`;
  const email = `e2e-csv-${Date.now()}@example.com`;

  await page.goto("/masters/media");
  await page.getByLabel("媒体名").fill(mediaName);
  await page.getByRole("button", { name: "追加" }).click();

  const mediaRow = page.getByRole("row").filter({ hasText: mediaName });
  await expect(mediaRow).toBeVisible();
  await mediaRow.getByRole("link", { name: "CSV取込" }).click();

  await expect(page.getByRole("heading", { name: `${mediaName} - CSV取込` })).toBeVisible();

  const csv = `姓,名,メールアドレス\nテスト,太郎,${email}`;
  await page.locator('input[type="file"]').setInputFiles({
    name: "import.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf-8"),
  });
  await page.getByRole("button", { name: "読み込み" }).click();

  await expect(page.getByText("1件を検出")).toBeVisible();
  await expect(page.getByLabel("姓", { exact: true })).toHaveValue("姓");
  await expect(page.getByLabel("名", { exact: true })).toHaveValue("名");
  await expect(page.getByLabel("メールアドレス", { exact: true })).toHaveValue("メールアドレス");

  await page.getByRole("button", { name: "この内容で取り込む" }).click();

  await expect(page.getByText(/1件中 1件を新規登録/)).toBeVisible();

  await page.goto("/applicants");
  const applicantRow = page.getByRole("row").filter({ hasText: email });
  await expect(applicantRow).toBeVisible();
  await expect(applicantRow.getByText("テスト 太郎")).toBeVisible();

  // FR042: 媒体別流入数に、まだ承諾段階に到達していないため承諾率0%が表示される
  await page.goto("/analytics");
  const mediaLink = page.getByRole("link").filter({ hasText: mediaName });
  await expect(mediaLink).toBeVisible();
  await expect(mediaLink.getByText("承諾0%")).toBeVisible();
});
