import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApplicantFromRequest } from "@/lib/mypage-auth";
import type { SurveyQuestion } from "@/app/(app)/masters/surveys/actions";

type AnswerInput = { questionId: string; value: string | string[] };

/** FR036: アンケートLIFFページからの回答を受け付ける。再回答は上書きする。 */
export async function POST(request: Request, { params }: RouteContext<"/api/survey/[id]/respond">) {
  const { id } = await params;

  const applicant = await getApplicantFromRequest(request);
  if (!applicant) {
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  const survey = await prisma.survey.findUnique({ where: { id } });
  if (!survey || survey.status !== "published") {
    return NextResponse.json({ error: "アンケートが見つかりません" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { answers?: AnswerInput[] } | null;
  const answers = body?.answers;
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: "回答の形式が不正です" }, { status: 400 });
  }

  const questions = survey.questions as unknown as SurveyQuestion[];
  const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.value]));
  for (const question of questions) {
    const value = answerByQuestionId.get(question.id);
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      return NextResponse.json({ error: `「${question.label}」に回答してください` }, { status: 400 });
    }
  }

  await prisma.surveyResponse.upsert({
    where: { survey_id_applicant_id: { survey_id: id, applicant_id: applicant.id } },
    create: { survey_id: id, applicant_id: applicant.id, answers },
    update: { answers, submitted_at: new Date() },
  });

  return NextResponse.json({ ok: true });
}
