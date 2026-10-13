import { test, expect } from "@playwright/test";

// 実際のLINEログイン(LIFF)はPlaywrightから操作できないため、LIFF側が行うはずの
// 「プロフィール取得→/api/line/registerへPOST」をこのテストが肩代わりして検証する。
// それ以外(トークン発行・画面表示)は実際のUIを通して検証する。
test("登録リンクを発行し、紐付けAPIを呼ぶと連携済み表示になる", async ({ page, request }) => {
  const lastName = "E2E";
  const firstName = `LINE${Date.now()}`;
  const email = `e2e-line-${Date.now()}@example.com`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();

  const row = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "登録リンクを発行" }).click();
  const linkCode = row.locator("code");
  await expect(linkCode).toBeVisible();
  const url = await linkCode.getAttribute("title");
  expect(url).toBeTruthy();
  const token = new URL(url!).searchParams.get("token");
  expect(token).toBeTruthy();

  const registerRes = await request.post("/api/line/register", {
    data: { token, lineUserId: `Ue2e${Date.now()}` },
  });
  expect(registerRes.ok()).toBeTruthy();

  await page.reload();
  await expect(row.getByText("連携済み")).toBeVisible();
});
