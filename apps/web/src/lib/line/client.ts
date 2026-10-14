import "server-only";
import { messagingApi, validateSignature, HTTPFetchError } from "@line/bot-sdk";

function getClient() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN が設定されていません");
  }
  return new messagingApi.MessagingApiClient({ channelAccessToken });
}

/** LINE応募者にテキストメッセージを送信する(FR031)。 */
export async function sendTextMessage(lineUserId: string, text: string) {
  const client = getClient();
  await client.pushMessage({
    to: lineUserId,
    messages: [{ type: "text", text }],
  });
}

/** LINE応募者に画像メッセージを送信する(FR032)。imageUrlは公開HTTPSのJPEG画像URL。 */
export async function sendImageMessage(lineUserId: string, imageUrl: string) {
  const client = getClient();
  await client.pushMessage({
    to: lineUserId,
    messages: [
      { type: "image", originalContentUrl: imageUrl, previewImageUrl: imageUrl },
    ],
  });
}

/** LINEの画像・ファイルメッセージの実体をContent APIから取得する(FR032: 受信側)。 */
export async function fetchLineMessageContent(
  messageId: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN が設定されていません");
  }
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${channelAccessToken}` },
  });
  if (!res.ok) {
    throw new Error(`LINEメッセージの取得に失敗しました: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

/**
 * LINE送信系の例外から、画面に安全に表示できる単純な文字列メッセージを取り出す。
 * `HTTPFetchError`は`headers`(Headers)等シリアライズ不可なプロパティを持つため、
 * Server Actionの戻り値としてそのままクライアントへ送るとReactのレンダリングが壊れる。
 * 呼び出し側は必ずこの関数を通した上で`new Error(...)`として投げ直すこと。
 */
export function describeLineSendError(error: unknown): string {
  if (error instanceof HTTPFetchError) {
    try {
      const body = JSON.parse(error.body) as { message?: string };
      if (body.message) return body.message;
    } catch {
      // bodyがJSONでない場合はerror.messageにフォールバックする
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "LINE送信に失敗しました";
}

/** Webhookリクエストの署名を検証する(LINE_CHANNEL_SECRETが必要)。 */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret || !signature) return false;
  return validateSignature(rawBody, channelSecret, signature);
}
