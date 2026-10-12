import { execSync } from "node:child_process";
import path from "node:path";
import { chromium, request, type FullConfig } from "@playwright/test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export const E2E_STAFF_EMAIL = "e2e-staff@fujiarte.local";
export const AUTH_STATE_PATH = path.join(__dirname, ".auth", "staff.json");

/**
 * Firebase Auth Emulator を使って、本物のGoogle OAuth画面を操作せずに
 * ログイン済みセッションCookieを作る。
 *   1. DBにテスト用Staffを直接作成する(seed.ts)
 *   2. Admin SDK(エミュレータ接続)でカスタムトークンを発行
 *   3. Auth EmulatorのREST APIでカスタムトークン → IDトークンに交換
 *      (Admin SDKはIDトークンを直接発行できないため)
 *   4. アプリ本体の /api/auth/session に本番と同じ経路でPOSTし、
 *      セッションCookieを発行させる
 * こうすることで、バイパスするのは「Googleのログイン画面」だけで、
 * アプリ側の検証ロジック(/api/auth/session)自体は本番同様にテストできる。
 */
export default async function globalSetup(config: FullConfig) {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      "FIREBASE_AUTH_EMULATOR_HOST が未設定です。`npm run test:e2e` 経由で実行してください。"
    );
  }

  execSync("npx tsx e2e/seed.ts", { cwd: __dirname + "/..", stdio: "inherit" });

  const adminApp = getApps().length
    ? getApps()[0]
    : initializeApp({ projectId: "fujiarte-ats-e2e" });
  const uid = "e2e-staff-uid";
  // カスタムトークンだけだとemailクレームが乗らないため、先にエミュレータ上に
  // 同じUIDでemail付きユーザーを作っておく(既にあれば無視する)。
  await getAuth(adminApp)
    .createUser({ uid, email: E2E_STAFF_EMAIL, emailVerified: true })
    .catch(() => {});
  const customToken = await getAuth(adminApp).createCustomToken(uid);

  const apiKey = "fake-api-key"; // エミュレータはAPIキーの値を検証しない
  const exchangeRes = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  if (!exchangeRes.ok) {
    throw new Error(`カスタムトークンの交換に失敗しました: ${await exchangeRes.text()}`);
  }
  const { idToken } = (await exchangeRes.json()) as { idToken: string };

  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  const apiContext = await request.newContext({ baseURL });
  const sessionRes = await apiContext.post("/api/auth/session", {
    data: { idToken },
  });
  if (!sessionRes.ok()) {
    throw new Error(`/api/auth/session への POST に失敗しました: ${await sessionRes.text()}`);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const cookies = sessionRes.headers()["set-cookie"] ?? "";
  const [nameValue] = cookies.split(";");
  const [name, value] = nameValue.split("=");
  await context.addCookies([
    {
      name,
      value,
      domain: new URL(baseURL).hostname,
      path: "/",
    },
  ]);
  await context.storageState({ path: AUTH_STATE_PATH });
  await browser.close();
  await apiContext.dispose();
}
