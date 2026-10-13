import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * LIFF登録ページから呼ばれる、応募者とLINE UserIdの紐付けエンドポイント(FR030)。
 * 認証は不要(応募者本人が自分のLINEアカウントを紐付けるための公開API)。
 * トークンの存在・有効期限・未使用であることのみを検証する。
 */
export async function POST(request: Request) {
  const { token, lineUserId } = (await request.json()) as {
    token?: string;
    lineUserId?: string;
  };
  if (!token || !lineUserId) {
    return NextResponse.json({ error: "token and lineUserId are required" }, { status: 400 });
  }

  const registrationToken = await prisma.lineRegistrationToken.findUnique({
    where: { token },
  });
  if (!registrationToken) {
    return NextResponse.json({ error: "無効なリンクです" }, { status: 404 });
  }
  if (registrationToken.used_at) {
    return NextResponse.json({ error: "このリンクは既に使用されています" }, { status: 409 });
  }
  if (registrationToken.expires_at < new Date()) {
    return NextResponse.json({ error: "このリンクの有効期限が切れています" }, { status: 410 });
  }

  const existing = await prisma.applicant.findUnique({ where: { line_user_id: lineUserId } });
  if (existing && existing.id !== registrationToken.applicant_id) {
    return NextResponse.json(
      { error: "このLINEアカウントは既に別の応募者に紐付けられています" },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.applicant.update({
      where: { id: registrationToken.applicant_id },
      data: { line_user_id: lineUserId, line_linked_at: new Date() },
    }),
    prisma.lineRegistrationToken.update({
      where: { token },
      data: { used_at: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
