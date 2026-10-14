import { test, expect } from "@playwright/test";

// 実際のLINEログイン(LIFF)はPlaywrightから操作できないため、line-register.spec.ts と同様に
// LIFF側が行うはずの操作(ID Token取得→マイページAPI呼び出し)をこのテストが肩代わりする。
// verifyLiffIdToken は FIREBASE_AUTH_EMULATOR_HOST 設定時に `e2e:<lineUserId>` 形式を
// そのまま信頼するため、Bearerトークンにその形式を使う。
test("マイページAPIで選考状況確認・プロフィール編集・書類アップロードができる", async ({
  page,
  request,
}) => {
  const lastName = "E2E";
  const firstName = `マイページ${Date.now()}`;
  const email = `e2e-mypage-${Date.now()}@example.com`;
  const lineUserId = `Ue2e-mypage-${Date.now()}`;

  await page.goto("/applicants");
  await page.getByLabel("姓").fill(lastName);
  await page.getByLabel("名").fill(firstName);
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "登録", exact: true }).click();

  const row = page.getByRole("row").filter({ hasText: `${lastName} ${firstName}` });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "登録リンクを発行" }).click();
  const linkCode = row.locator("code");
  const url = await linkCode.getAttribute("title");
  const token = new URL(url!).searchParams.get("token");

  const registerRes = await request.post("/api/line/register", {
    data: { token, lineUserId },
  });
  expect(registerRes.ok()).toBeTruthy();

  const authHeader = { Authorization: `Bearer e2e:${lineUserId}` };

  const meRes = await request.get("/api/mypage/me", { headers: authHeader });
  expect(meRes.ok()).toBeTruthy();
  const me = await meRes.json();
  expect(me.last_name).toBe(lastName);
  expect(me.first_name).toBe(firstName);
  expect(me.steps.length).toBeGreaterThan(0);
  expect(me.steps[0].status).toBe("current");
  expect(me.resume_url).toBeNull();

  const profileRes = await request.post("/api/mypage/profile", {
    headers: authHeader,
    data: { phone: "090-1234-5678" },
  });
  expect(profileRes.ok()).toBeTruthy();

  const uploadRes = await request.post("/api/mypage/documents", {
    headers: authHeader,
    multipart: {
      kind: "resume",
      file: {
        name: "es.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 e2e test"),
      },
    },
  });
  expect(uploadRes.ok()).toBeTruthy();
  const uploadBody = await uploadRes.json();
  expect(uploadBody.url).toBeTruthy();

  const meAfterRes = await request.get("/api/mypage/me", { headers: authHeader });
  const meAfter = await meAfterRes.json();
  expect(meAfter.phone).toBe("090-1234-5678");
  expect(meAfter.resume_url).toBe(uploadBody.url);
});
