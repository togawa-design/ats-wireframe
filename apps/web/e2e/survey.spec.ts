import { test, expect } from "@playwright/test";

test("アンケートを作成・公開・送信でき、LIFF経由の回答が記録される(FR036)", async ({
  page,
  request,
}) => {
  const suffix = Date.now();
  const title = `E2Eアンケート${suffix}`;

  // 管理画面: アンケートを作成(自由記述1問 + 単一選択1問)
  await page.goto("/masters/surveys");
  await page.getByLabel("タイトル").fill(title);
  const createForm = page.locator("#survey-create-form");
  await createForm.getByLabel("内容").first().fill("感想を教えてください");
  await page.getByRole("button", { name: "質問を追加" }).click();
  await createForm.getByLabel("内容").nth(1).fill("満足度は?");
  await createForm.getByLabel("回答形式").nth(1).selectOption("single_choice");
  await createForm.getByLabel("選択肢(改行区切り)").fill("満足\n不満");
  await page.getByRole("button", { name: "下書きとして作成" }).click();

  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row.getByText("下書き")).toBeVisible();

  await row.getByRole("link", { name: title }).click();
  await page.waitForURL(/\/masters\/surveys\/.+/);
  const surveyId = page.url().split("/").pop()!;
  await expect(page.getByRole("listitem").filter({ hasText: "感想を教えてください" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "満足度は?" })).toBeVisible();

  // 公開する
  await page.getByRole("button", { name: "公開する" }).click();
  await expect(page.getByText("公開中")).toBeVisible();

  // 送信を試みる(E2E環境には実際のLIFFアプリ設定が無いため失敗する想定)
  await page.getByRole("button", { name: "送信する" }).click();
  await expect(page.getByText("NEXT_PUBLIC_SURVEY_LIFF_ID が設定されていません")).toBeVisible();

  // LIFF側が行うはずの回答操作を、応募者登録+LINE連携+Bearerトークンで肩代わりする
  // (mypage.spec.ts / line-register.spec.ts と同じ手法)。
  const lastName = "E2E";
  const firstName = `アンケート${suffix}`;
  const email = `e2e-survey-${suffix}@example.com`;
  const lineUserId = `Ue2e-survey-${suffix}`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();

  const applicantRow = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(applicantRow).toBeVisible();
  await applicantRow.getByRole("button", { name: "登録リンクを発行" }).click();
  const linkCode = applicantRow.locator("code");
  const url = await linkCode.getAttribute("title");
  const token = new URL(url!).searchParams.get("token");

  const registerRes = await request.post("/api/line/register", { data: { token, lineUserId } });
  expect(registerRes.ok()).toBeTruthy();

  const authHeader = { Authorization: `Bearer e2e:${lineUserId}` };

  const getRes = await request.get(`/api/survey/${surveyId}`, { headers: authHeader });
  expect(getRes.ok()).toBeTruthy();
  const surveyBody = await getRes.json();
  expect(surveyBody.title).toBe(title);
  expect(surveyBody.alreadySubmitted).toBe(false);
  expect(surveyBody.questions).toHaveLength(2);

  const [q1, q2] = surveyBody.questions;

  // 全問回答しないと400になる
  const incompleteRes = await request.post(`/api/survey/${surveyId}/respond`, {
    headers: authHeader,
    data: { answers: [{ questionId: q1.id, value: "とても良かったです" }] },
  });
  expect(incompleteRes.status()).toBe(400);

  const respondRes = await request.post(`/api/survey/${surveyId}/respond`, {
    headers: authHeader,
    data: {
      answers: [
        { questionId: q1.id, value: "とても良かったです" },
        { questionId: q2.id, value: "満足" },
      ],
    },
  });
  expect(respondRes.ok()).toBeTruthy();

  const getAfterRes = await request.get(`/api/survey/${surveyId}`, { headers: authHeader });
  const surveyAfter = await getAfterRes.json();
  expect(surveyAfter.alreadySubmitted).toBe(true);

  await page.goto(`/masters/surveys/${surveyId}`);
  await expect(page.getByText("とても良かったです")).toBeVisible();
  await expect(page.getByText("満足: 1件")).toBeVisible();
  await expect(page.getByText("不満: 0件")).toBeVisible();
});
