import { test, expect } from "@playwright/test";

test("ステージをスキップして移動すると理由の入力を求められ、選考履歴に記録される(FR096)", async ({
  page,
}) => {
  const lastName = "E2E";
  const firstName = `スキップ${Date.now()}`;
  const email = `e2e-skip-${Date.now()}@example.com`;
  const reason = "本人の意向により書類選考を省略";

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

  // エントリー→1次面接は「書類選考」を飛ばすスキップ移動(FR096)のため、
  // 理由入力のprompt()が表示される。
  const targetColumn = page.locator('[data-stage-name="1次面接"]');
  const sourceBox = await card.boundingBox();
  const targetBox = await targetColumn.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("ドラッグ元/先の座標が取得できませんでした");

  page.once("dialog", (dialog) => {
    expect(dialog.type()).toBe("prompt");
    dialog.accept(reason);
  });

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 20,
    sourceBox.y + sourceBox.height / 2,
    { steps: 5 }
  );
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 10,
  });
  await page.mouse.up();

  await expect(targetColumn.getByText(`${lastName} ${firstName}`)).toBeVisible({ timeout: 10000 });

  // 応募者詳細の選考履歴にスキップ理由が記録されている
  await page.goto("/applicants");
  const applicantRow = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await applicantRow.getByRole("link", { name: `${lastName} ${firstName}` }).click();
  await page.waitForURL(/\/applicants\/.+/);
  await expect(page.getByText(`スキップ理由: ${reason}`)).toBeVisible();
});
