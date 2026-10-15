import { test, expect } from "@playwright/test";

test("選考結果を複数の応募者へ一括登録できる(FR097)", async ({ page }) => {
  const suffix = Date.now();
  const nameA = `一括A${suffix}`;
  const nameB = `一括B${suffix}`;

  await page.goto("/applicants");
  const createForm = page.getByRole("form", { name: "新規応募者登録フォーム" });

  await createForm.getByLabel("姓").fill("E2E");
  await createForm.getByLabel("名").fill(nameA);
  await createForm.getByLabel("メールアドレス").fill(`e2e-bulk-a-${suffix}@example.com`);
  await createForm.getByRole("button", { name: "登録", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: nameA })).toBeVisible();

  await createForm.getByLabel("姓").fill("E2E");
  await createForm.getByLabel("名").fill(nameB);
  await createForm.getByLabel("メールアドレス").fill(`e2e-bulk-b-${suffix}@example.com`);
  await createForm.getByRole("button", { name: "登録", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: nameB })).toBeVisible();

  await page.goto("/selections");
  await page.getByRole("button", { name: "リスト" }).click();

  const rowA = page.getByRole("row").filter({ hasText: nameA });
  const rowB = page.getByRole("row").filter({ hasText: nameB });
  await expect(rowA).toBeVisible();
  await expect(rowB).toBeVisible();

  await rowA.getByRole("checkbox").check();
  await rowB.getByRole("checkbox").check();
  await expect(page.getByText("2件選択中(FR097)")).toBeVisible();

  await page.getByLabel("一括変更後の結果").selectOption("failed");
  await page.getByRole("button", { name: "選択した応募者に一括適用" }).click();

  await expect(rowA.locator("select")).toHaveValue("failed");
  await expect(rowB.locator("select")).toHaveValue("failed");
});
