import { test, expect } from "@playwright/test";

test("カンバンでカードをドラッグするとステージが変わる", async ({ page }) => {
  const lastName = "E2E";
  const firstName = `カンバン${Date.now()}`;
  const email = `e2e-kanban-${Date.now()}@example.com`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` })
  ).toBeVisible();

  await page.goto("/selections");
  // デフォルトでカンバン表示。応募登録時に作成されたSelectionは最初のステージ(エントリー)に入る。
  const card = page.getByText(`${lastName} ${firstName}`);
  await expect(card).toBeVisible();

  const targetColumn = page.locator('[data-stage-name="書類選考"]');
  const sourceBox = await card.boundingBox();
  const targetBox = await targetColumn.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("ドラッグ元/先の座標が取得できませんでした");

  // dnd-kitのPointerSensor(activationConstraint distance:5)はある程度の段階的な
  // pointermoveが無いとドラッグ開始と認識しないため、dragTo()ではなく
  // mouse操作を複数ステップに分けて手動でシミュレートする。
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2, {
    steps: 5,
  });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 10,
  });
  await page.mouse.up();

  await expect(targetColumn.getByText(`${lastName} ${firstName}`)).toBeVisible({ timeout: 10000 });
});
