import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApplicantFromRequest } from "@/lib/mypage-auth";

/** FR002: マイページからのプロフィール編集(電話番号)。 */
export async function POST(request: Request) {
  const applicant = await getApplicantFromRequest(request);
  if (!applicant) {
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  const { phone } = (await request.json()) as { phone?: string };
  const trimmed = (phone ?? "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "電話番号を入力してください" }, { status: 400 });
  }

  await prisma.applicant.update({
    where: { id: applicant.id },
    data: { phone: trimmed },
  });

  return NextResponse.json({ ok: true });
}
