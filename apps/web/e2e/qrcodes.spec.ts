import { test, expect } from "@playwright/test";

test("QRコードを発行すると画像とスキャン用URLが表示され、スキャンするとスキャン数が増える", async ({
  page,
  request,
}) => {
  const label = `E2Eテスト説明会${Date.now()}`;

  await page.goto("/masters/qrcodes");
  await page.getByLabel("ラベル").fill(label);
  await page.getByLabel("遷移先URL").fill("https://example.com/landing");
  await page.getByRole("button", { name: "発行" }).click();

  const row = page.getByRole("row").filter({ hasText: label });
  await expect(row).toBeVisible();
  await expect(row.getByRole("img")).toBeVisible();
  const scanCountCell = row.locator("td").nth(4);
  await expect(scanCountCell).toHaveText("0");

  const scanLink = row.getByRole("link");
  const scanUrl = await scanLink.getAttribute("href");
  expect(scanUrl).toBeTruthy();

  const res = await request.get(scanUrl!, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toBe("https://example.com/landing");

  await page.reload();
  const updatedRow = page.getByRole("row").filter({ hasText: label });
  await expect(updatedRow.locator("td").nth(4)).toHaveText("1");
});
