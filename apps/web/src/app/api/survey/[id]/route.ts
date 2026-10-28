import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApplicantFromRequest } from "@/lib/mypage-auth";

/** FR036: アンケートLIFFページ用に質問一覧(または既存の回答)を返す。 */
export async function GET(request: Request, { params }: RouteContext<"/api/survey/[id]">) {
  const { id } = await params;

  const applicant = await getApplicantFromRequest(request);
  if (!applicant) {
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  const survey = await prisma.survey.findUnique({ where: { id } });
  if (!survey || survey.status !== "published") {
    return NextResponse.json({ error: "アンケートが見つかりません" }, { status: 404 });
  }

  const existing = await prisma.surveyResponse.findUnique({
    where: { survey_id_applicant_id: { survey_id: id, applicant_id: applicant.id } },
  });

  return NextResponse.json({
    title: survey.title,
    description: survey.description,
    questions: survey.questions,
    alreadySubmitted: !!existing,
    answers: existing?.answers ?? null,
  });
}
