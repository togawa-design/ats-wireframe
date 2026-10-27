import { test, expect } from "@playwright/test";

test("応募者詳細画面でタグを編集できる", async ({ page }) => {
  const suffix = Date.now();
  const tagA = `E2Eタグ編集A${suffix}`;
  const tagB = `E2Eタグ編集B${suffix}`;
  const lastName = "E2E";
  const firstName = `タグ編集${suffix}`;
  const email = `e2e-tag-edit-${suffix}@example.com`;

  await page.goto("/masters/tags");
  await page.getByLabel("タグ名").fill(tagA);
  await page.getByRole("button", { name: "追加" }).click();
  await expect(page.getByRole("row").filter({ hasText: tagA })).toBeVisible();
  await page.getByLabel("タグ名").fill(tagB);
  await page.getByRole("button", { name: "追加" }).click();
  await expect(page.getByRole("row").filter({ hasText: tagB })).toBeVisible();

  await page.goto("/applicants");
  const createForm = page.getByRole("form", { name: "新規応募者登録フォーム" });
  await createForm.getByLabel("姓").fill(lastName);
  await createForm.getByLabel("名").fill(firstName);
  await createForm.getByLabel("メールアドレス").fill(email);
  await createForm.getByLabel(tagA, { exact: true }).check();
  await createForm.getByRole("button", { name: "登録", exact: true }).click();

  const row = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: `${lastName} ${firstName}` }).click();
  await page.waitForURL(/\/applicants\/.+/);

  await expect(page.getByLabel(tagA, { exact: true })).toBeChecked();
  await expect(page.getByLabel(tagB, { exact: true })).not.toBeChecked();

  await page.getByLabel(tagA, { exact: true }).uncheck();
  await page.getByLabel(tagB, { exact: true }).check();
  await page.getByRole("button", { name: "タグを更新" }).click();

  await expect(page.getByLabel(tagA, { exact: true })).not.toBeChecked();
  await expect(page.getByLabel(tagB, { exact: true })).toBeChecked();
});
