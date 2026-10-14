import { NextResponse } from "next/server";
import type { webhook } from "@line/bot-sdk";
import { verifyLineSignature, fetchLineMessageContent } from "@/lib/line/client";
import { uploadLineMessageImage } from "@/lib/firebase/storage";
import { prisma } from "@/lib/prisma";

/**
 * LINE Platformからのwebhook受信エンドポイント。
 * FR030/031/032スコープでは「テキスト・画像メッセージの受信ログ記録」を扱う。
 * リッチメニュー自動応答(FR120)やシナリオ実行(FR124/125)はPhase2以降。
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as webhook.CallbackRequest;

  for (const event of body.events) {
    if (event.type !== "message") continue;
    if (event.source?.type !== "user" || !event.source.userId) continue;
    if (event.message.type !== "text" && event.message.type !== "image") continue;

    const applicant = await prisma.applicant.findUnique({
      where: { line_user_id: event.source.userId },
      select: { id: true },
    });
    // 未登録ユーザー(応募者として紐付いていないLINEアカウント)からのメッセージは無視する。
    if (!applicant) continue;

    if (event.message.type === "text") {
      await prisma.lineMessage.create({
        data: {
          applicant_id: applicant.id,
          direction: "inbound",
          message_type: "text",
          content: event.message.text,
        },
      });
      continue;
    }

    const { buffer, contentType } = await fetchLineMessageContent(event.message.id);
    const fileUrl = await uploadLineMessageImage(applicant.id, buffer, contentType);
    await prisma.lineMessage.create({
      data: {
        applicant_id: applicant.id,
        direction: "inbound",
        message_type: "image",
        file_url: fileUrl,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
