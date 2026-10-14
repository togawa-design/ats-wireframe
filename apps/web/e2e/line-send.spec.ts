import { test, expect } from "@playwright/test";

test("LINE連携済みの応募者にメッセージを送信すると結果が表示される", async ({ page, request }) => {
  const lastName = "E2E";
  const firstName = `送信${Date.now()}`;
  const email = `e2e-line-send-${Date.now()}@example.com`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();

  const row = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await row.getByRole("button", { name: "登録リンクを発行" }).click();
  const url = await row.locator("code").getAttribute("title");
  const token = new URL(url!).searchParams.get("token");
  await request.post("/api/line/register", {
    data: { token, lineUserId: `Ue2esend${Date.now()}` },
  });

  await page.goto("/line-send");
  const messageText = `{{last_name}} {{first_name}} さん、こんにちは(${Date.now()})`;
  await page.getByLabel("メッセージ本文").fill(messageText);
  await page.getByRole("button", { name: "送信" }).click();

  // 実際のLINE送信はテスト環境では成功しない(本物のチャネルが無いため)が、
  // 「何件中何件送信できたか」という結果表示まで一気通貫で動くことを確認する。
  await expect(page.getByText(/件中、\d+件送信しました/)).toBeVisible();

  // FR033: 送信履歴に今回の送信が記録される(実送信は失敗するため送信数は0件)。
  await page.reload();
  const historyRow = page.getByRole("row").filter({ hasText: messageText });
  await expect(historyRow).toBeVisible();
  await expect(historyRow.locator("td").nth(5)).toHaveText("0");
});
