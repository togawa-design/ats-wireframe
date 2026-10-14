import { test, expect } from "@playwright/test";

// line-send.spec.ts と同様、実際のLINEチャネルが無いテスト環境では送信自体は失敗するため、
// エラーメッセージが画面まで一気通貫で表示されることを確認する。
test("応募者詳細画面でLINE連携済みならチャットスレッドと送信フォームが表示される", async ({
  page,
  request,
}) => {
  const lastName = "E2E";
  const firstName = `LINEチャット${Date.now()}`;
  const email = `e2e-line-chat-${Date.now()}@example.com`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();

  const row = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "登録リンクを発行" }).click();
  const url = await row.locator("code").getAttribute("title");
  const token = new URL(url!).searchParams.get("token");
  await request.post("/api/line/register", {
    data: { token, lineUserId: `Ue2echat${Date.now()}` },
  });

  await row.getByRole("link", { name: `${lastName} ${firstName}` }).click();

  await expect(page.getByText("LINEメッセージ(FR032)")).toBeVisible();
  await expect(page.getByTestId("line-message-thread")).toContainText("まだメッセージはありません");

  await page.getByPlaceholder("メッセージを入力").fill("こんにちは");
  await page.getByRole("button", { name: "送信" }).click();

  // 実際のLINE送信はテスト環境では成功しない(本物のチャネルが無いため)が、
  // エラーがUIまで伝播することを確認する。
  await expect(page.getByText("LINE_CHANNEL_ACCESS_TOKEN が設定されていません")).toBeVisible();
});
