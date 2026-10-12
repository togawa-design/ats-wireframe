import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { SESSION_COOKIE_NAME, SESSION_EXPIRES_IN_MS } from "@/lib/auth-constants";

export { SESSION_COOKIE_NAME, SESSION_EXPIRES_IN_MS };

// applicationDefault() は Cloud Run / Firebase App Hosting 上ではメタデータサーバーの
// 認証情報を、ローカル開発では GOOGLE_APPLICATION_CREDENTIALS が指すサービスアカウント
// JSONを自動的に使う(ADCの標準的な解決順序)。
// FIREBASE_AUTH_EMULATOR_HOST が設定されている場合(E2Eテスト時)は、Authの検証は
// エミュレータ側で行われ実際の認証情報を必要としないため、credentialを省略する。
const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp(
      process.env.FIREBASE_AUTH_EMULATOR_HOST
        ? { projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }
        : {
            credential: applicationDefault(),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          }
    );

export const adminAuth = getAuth(adminApp);

export async function createSessionCookie(idToken: string) {
  return adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRES_IN_MS,
  });
}

export async function verifySessionCookie(sessionCookie: string) {
  return adminAuth.verifySessionCookie(sessionCookie, true);
}
