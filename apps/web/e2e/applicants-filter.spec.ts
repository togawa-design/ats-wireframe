import { test, expect } from "@playwright/test";

test("応募者一覧を氏名・応募者区分で絞り込める", async ({ page }) => {
  const suffix = Date.now();
  const nameA = `フィルタA${suffix}`;
  const nameB = `フィルタB${suffix}`;

  await page.goto("/applicants");
  const createForm = page.getByRole("form", { name: "新規応募者登録フォーム" });

  await createForm.getByLabel("姓").fill("E2E");
  await createForm.getByLabel("名").fill(nameA);
  await createForm.getByLabel("メールアドレス").fill(`e2e-filter-a-${suffix}@example.com`);
  await createForm.getByRole("button", { name: "登録", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: nameA })).toBeVisible();

  await createForm.getByLabel("姓").fill("E2E");
  await createForm.getByLabel("名").fill(nameB);
  await createForm.getByLabel("メールアドレス").fill(`e2e-filter-b-${suffix}@example.com`);
  await createForm.getByLabel("応募者区分").selectOption("existing_grad");
  await createForm.getByRole("button", { name: "登録", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: nameB })).toBeVisible();

  const filterForm = page.getByRole("form", { name: "絞り込み検索フォーム" });

  // 氏名(キーワード)で絞り込むとAのみ表示される
  await filterForm.getByLabel("キーワード").fill(nameA);
  await filterForm.getByRole("button", { name: "絞り込む" }).click();
  await expect(page.getByRole("row").filter({ hasText: nameA })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: nameB })).toHaveCount(0);

  // クリアして応募者区分(既卒)で絞り込むとBのみ表示される
  await page.getByRole("link", { name: "クリア" }).click();
  await page.getByRole("form", { name: "絞り込み検索フォーム" }).getByLabel("応募者区分").selectOption("existing_grad");
  await page.getByRole("form", { name: "絞り込み検索フォーム" }).getByRole("button", { name: "絞り込む" }).click();
  await expect(page.getByRole("row").filter({ hasText: nameB })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: nameA })).toHaveCount(0);
});
