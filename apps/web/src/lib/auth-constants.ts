// proxy.ts (nodejs runtimeだが毎リクエスト実行される) と admin.ts
// (firebase-adminの初期化を伴う)の両方から参照するため、副作用のない
// 定数だけを独立したファイルに分離している。
export const SESSION_COOKIE_NAME = "ats_session";
export const SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000; // 14日
