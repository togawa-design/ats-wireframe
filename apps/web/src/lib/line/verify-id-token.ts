import "server-only";

const E2E_TEST_PREFIX = "e2e:";

/**
 * LIFF ID TokenをLINEの検証エンドポイントで検証し、本人のLINE UserIdを取得する(FR002マイページ認証)。
 * マイページAPIは一度リンクされたLINEアカウント本人だけが呼べる必要があるため、
 * FR030の登録APIとは異なりクライアントが申告するUserIdをそのまま信用せず、
 * ID Tokenの署名検証(LINE側)を必ず経由する。
 *
 * E2Eテスト環境(FIREBASE_AUTH_EMULATOR_HOSTが設定されている)では実際のLINEサーバーを
 * 呼べないため、`e2e:`で始まるトークンに限りそのままUserIdとして信頼する。本番では
 * FIREBASE_AUTH_EMULATOR_HOSTが設定されていないためこの分岐には入らない。
 */
export async function verifyLiffIdToken(idToken: string): Promise<string> {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST && idToken.startsWith(E2E_TEST_PREFIX)) {
    return idToken.slice(E2E_TEST_PREFIX.length);
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) throw new Error("LINE_LOGIN_CHANNEL_ID が設定されていません");

  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });
  if (!res.ok) throw new Error("LINEログインの検証に失敗しました");

  const data = (await res.json()) as { sub?: string };
  if (!data.sub) throw new Error("LINEログインの検証に失敗しました");
  return data.sub;
}
