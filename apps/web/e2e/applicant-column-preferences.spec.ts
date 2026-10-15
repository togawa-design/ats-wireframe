import { test, expect } from "@playwright/test";

/**
 * FR099: 応募者一覧の表示列はE2Eで共有される単一スタッフアカウントに紐づく
 * グローバルな設定のため、他specが依存する「全列表示」の状態に必ず戻してから
 * テストを終える(アサーション失敗時もtry/finallyで必ず復元する)。また、過去の
 * 実行で残った並び順に依存しないよう、開始時にも一旦すべて表示状態へそろえる。
 */
test("応募者一覧の表示列の表示/非表示・並び順を設定・保存できる", async ({ page }) => {
  const lastName = "E2E";
  const firstName = `列設定${Date.now()}`;
  const email = `e2e-columns-${Date.now()}@example.com`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` })
  ).toBeVisible();

  await ensureAllColumnsVisible(page);
  await expect(page.getByRole("columnheader", { name: "学校" })).toBeVisible();

  try {
    // 「学校」列を非表示にして保存する
    await openColumnSettings(page);
    await page.getByTestId("column-toggle-school").uncheck();
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("columnheader", { name: "学校" })).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "メールアドレス" })).toBeVisible();

    // 「メールアドレス」を1つ動かして保存する(他specの実行順序によって既定の
    // 並び順から変化している可能性があるため、絶対位置ではなく「1つ動いたこと」を
    // 相対的に検証する。最下部にある場合は下へ動かせないため上へ動かす)。
    const headersBefore = await page.getByRole("columnheader").allTextContents();
    const emailIndexBefore = headersBefore.indexOf("メールアドレス");

    await openColumnSettings(page);
    const moveDown = page.getByTestId("column-down-email");
    const movedDown = !(await moveDown.isDisabled());
    if (movedDown) {
      await moveDown.click();
    } else {
      await page.getByTestId("column-up-email").click();
    }
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();

    await page.reload();
    const headersAfter = await page.getByRole("columnheader").allTextContents();
    expect(headersAfter.indexOf("メールアドレス")).toBe(emailIndexBefore + (movedDown ? 1 : -1));
  } finally {
    // 他のE2Eテストに影響しないよう、全列を表示状態に戻す(並び順は他specが
    // 依存していないため復元不要)。
    await page.goto("/applicants");
    await ensureAllColumnsVisible(page);
    await expect(page.getByRole("columnheader", { name: "学校" })).toBeVisible();
  }
});

/**
 * 表示列設定の`<details>`を確実に開いた状態にする。summaryのクリックは
 * 開閉をトグルするため、既に開いている状態で再度呼ぶと閉じてしまう。
 * 代わりに`open`プロパティを直接trueにし、現在の状態によらず必ず開く。
 */
async function openColumnSettings(page: import("@playwright/test").Page) {
  await page
    .getByTestId("column-settings")
    .evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });
}

/** 表示列設定を開き、すべての列を表示状態にして保存する(未保存の変更が無ければ何もしない)。 */
async function ensureAllColumnsVisible(page: import("@playwright/test").Page) {
  await openColumnSettings(page);
  const checkboxes = page.locator('[data-testid^="column-toggle-"]');
  const count = await checkboxes.count();
  let changed = false;
  for (let i = 0; i < count; i++) {
    if (!(await checkboxes.nth(i).isChecked())) {
      await checkboxes.nth(i).check();
      changed = true;
    }
  }
  if (changed) {
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();
  }
}
