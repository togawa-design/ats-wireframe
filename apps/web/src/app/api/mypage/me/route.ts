import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApplicantFromRequest } from "@/lib/mypage-auth";

/** FR002: マイページ初期表示用の応募者情報・選考進捗を返す。 */
export async function GET(request: Request) {
  const applicant = await getApplicantFromRequest(request);
  if (!applicant) {
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  // FR033: LINE個人既読確認はAPI仕様上不可のため、マイページアクセス日時を
  // 「開封」の代替指標として記録する(U-01)。
  await prisma.applicant.update({
    where: { id: applicant.id },
    data: { mypage_last_accessed_at: new Date() },
  });

  const stages = applicant.selection?.flow.stages ?? [];
  const currentOrder = applicant.selection?.current_stage.order ?? null;
  const steps = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    status:
      currentOrder === null
        ? "upcoming"
        : stage.order < currentOrder
          ? "done"
          : stage.order === currentOrder
            ? "current"
            : "upcoming",
  }));

  return NextResponse.json({
    last_name: applicant.last_name,
    first_name: applicant.first_name,
    school_name: applicant.school?.name ?? null,
    department: applicant.department,
    phone: applicant.phone,
    resume_url: applicant.resume_url,
    photo_url: applicant.photo_url,
    steps,
  });
}
