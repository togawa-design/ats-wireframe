import { NextResponse } from "next/server";
import type { webhook } from "@line/bot-sdk";
import { verifyLineSignature } from "@/lib/line/client";
import { prisma } from "@/lib/prisma";

/**
 * LINE Platformからのwebhook受信エンドポイント。
 * FR030/031スコープでは「テキストメッセージの受信ログ記録」のみを扱う。
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
    if (event.message.type !== "text") continue;

    const applicant = await prisma.applicant.findUnique({
      where: { line_user_id: event.source.userId },
      select: { id: true },
    });
    // 未登録ユーザー(応募者として紐付いていないLINEアカウント)からのメッセージは無視する。
    if (!applicant) continue;

    await prisma.lineMessage.create({
      data: {
        applicant_id: applicant.id,
        direction: "inbound",
        message_type: "text",
        content: event.message.text,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
