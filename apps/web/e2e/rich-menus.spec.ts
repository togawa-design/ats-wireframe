import { test, expect } from "@playwright/test";

function fakePngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  buf.writeUInt32BE(0x89504e47, 0);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

test("リッチメニューを作成してタグルールを設定でき、公開にはLINEチャネルが必要なことを確認できる(FR034/035)", async ({
  page,
}) => {
  const suffix = Date.now();
  const menuName = `E2Eリッチメニュー${suffix}`;
  const tagName = `E2Eリッチメニュー用タグ${suffix}`;

  // タグを1件用意しておく(ルール設定に使う)
  await page.goto("/masters/tags");
  await page.getByLabel("タグ名").fill(tagName);
  await page.getByRole("button", { name: "追加" }).click();
  await expect(page.getByRole("row").filter({ hasText: tagName })).toBeVisible();

  // リッチメニューを下書きとして作成する(1分割レイアウト・URLアクション)
  await page.goto("/masters/rich-menus");
  await page.getByLabel("名前").fill(menuName);
  await page.getByLabel("チャットバーのテキスト(14文字以内)").fill("メニュー");
  await page.getByLabel("レイアウト").selectOption("one");
  await page.getByLabel("ラベル(管理用)").fill("リンク");
  await page.getByLabel("遷移先URL(URLを開くを選んだ場合)").fill("https://example.com");
  await page.getByRole("button", { name: "下書きとして作成" }).click();

  const row = page.getByRole("row").filter({ hasText: menuName });
  await expect(row).toBeVisible();
  await expect(row.getByText("下書き")).toBeVisible();

  await row.getByRole("link", { name: menuName }).click();
  await page.waitForURL(/\/masters\/rich-menus\/.+/);
  await expect(page.getByRole("heading", { name: menuName })).toBeVisible();
  await expect(page.getByText("タグルールはまだありません(既定メニュー扱い)")).toBeVisible();

  // FR035: タグルールを追加・削除できる(LINE APIを呼ばない操作のため成功する)
  await page.getByLabel("追加するタグ").selectOption({ label: tagName });
  await page.getByRole("button", { name: "ルールを追加" }).click();
  await expect(page.getByText("タグルールはまだありません(既定メニュー扱い)")).toHaveCount(0);
  const ruleBadge = page.getByText(tagName, { exact: true });
  await expect(ruleBadge).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page
    .locator("div")
    .filter({ hasText: tagName })
    .getByRole("button", { name: "削除" })
    .first()
    .click();
  await expect(page.getByText("タグルールはまだありません(既定メニュー扱い)")).toBeVisible();

  // FR034: 公開を試みる(E2E環境には実際のLINEチャネルが無いため失敗する想定で、
  // エラーが画面に表示されることを確認する)
  await page.locator('input[type="file"]').setInputFiles({
    name: "menu.png",
    mimeType: "image/png",
    buffer: fakePngBuffer(2500, 1686),
  });
  await page.getByRole("button", { name: "公開する" }).click();
  await expect(page.getByText("LINE_CHANNEL_ACCESS_TOKEN が設定されていません")).toBeVisible();

  // 公開に失敗しているため、下書きのまま
  await page.reload();
  await expect(page.getByText("下書き")).toBeVisible();
});
