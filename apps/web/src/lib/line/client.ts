import "server-only";
import { messagingApi, validateSignature } from "@line/bot-sdk";

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

/** Webhookリクエストの署名を検証する(LINE_CHANNEL_SECRETが必要)。 */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret || !signature) return false;
  return validateSignature(rawBody, channelSecret, signature);
}
