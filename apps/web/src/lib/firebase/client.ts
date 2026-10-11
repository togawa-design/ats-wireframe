"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 初期化はブラウザでの呼び出し時まで遅延させる。モジュール評価時に実行すると
// 環境変数未設定時のNext.jsビルド時プリレンダリングでエラーになるため。
function getFirebaseAuth() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

/** Google OAuth でサインインし、Firebase ID トークンを返す。 */
export async function signInWithGoogle() {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  // Cloud Run からガルーン連携で Calendar スコープも将来的に使う想定(architecture.html参照)。
  const credential = await signInWithPopup(auth, provider);
  return credential.user.getIdToken();
}

export async function signOut() {
  await firebaseSignOut(getFirebaseAuth());
}
