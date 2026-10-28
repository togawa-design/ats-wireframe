import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { canSendLine } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/delete-button";
import type { SurveyQuestion } from "../actions";
import { deleteSurvey } from "../actions";
import { PublishButton } from "./publish-button";
import { UnpublishButton } from "./unpublish-button";
import { SendForm } from "./send-form";
import { RemindButton } from "./remind-button";

export default async function SurveyDetailPage({ params }: PageProps<"/masters/surveys/[id]">) {
  const { id } = await params;

  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  const canEdit = canSendLine(staff);

  const [survey, tags, recipients, responses] = await Promise.all([
    prisma.survey.findUnique({ where: { id } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.surveyRecipient.findMany({
      where: { survey_id: id },
      include: { applicant: { select: { id: true, last_name: true, first_name: true } } },
    }),
    prisma.surveyResponse.findMany({ where: { survey_id: id } }),
  ]);
  if (!survey) notFound();

  const questions = survey.questions as unknown as SurveyQuestion[];
  const respondedApplicantIds = new Set(responses.map((r) => r.applicant_id));
  const unresponded = recipients.filter((r) => !respondedApplicantIds.has(r.applicant_id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/masters/surveys" className="text-sm text-muted-foreground hover:underline">
          ← アンケート一覧に戻る
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">{survey.title}</h1>
          <Badge variant={survey.status === "published" ? "default" : "outline"}>
            {survey.status === "published" ? "公開中" : "下書き"}
          </Badge>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">質問一覧</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {survey.description && <p className="text-muted-foreground">{survey.description}</p>}
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            {questions.map((q) => (
              <li key={q.id}>
                {q.label}
                {q.options && q.options.length > 0 && (
                  <span className="text-muted-foreground">(選択肢: {q.options.join(" / ")})</span>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {canEdit && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">公開操作</CardTitle>
          </CardHeader>
          <CardContent>
            {survey.status === "draft" ? (
              <PublishButton surveyId={survey.id} />
            ) : (
              <UnpublishButton surveyId={survey.id} />
            )}
          </CardContent>
        </Card>
      )}

      {canEdit && survey.status === "published" && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">送信</CardTitle>
          </CardHeader>
          <CardContent>
            <SendForm surveyId={survey.id} tags={tags} />
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">
            回答状況: {responses.length}/{recipients.length}件
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {questions.map((q) => (
            <div key={q.id}>
              <p className="text-xs font-bold text-foreground">{q.label}</p>
              {q.type === "text" ? (
                <ul className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
                  {responses.length === 0 && <li>まだ回答がありません</li>}
                  {responses.map((r) => {
                    const answers = r.answers as unknown as { questionId: string; value: unknown }[];
                    const answer = answers.find((a) => a.questionId === q.id);
                    return answer ? <li key={r.id}>・{String(answer.value)}</li> : null;
                  })}
                </ul>
              ) : (
                <ul className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
                  {(q.options ?? []).map((option) => {
                    const count = responses.filter((r) => {
                      const answers = r.answers as unknown as { questionId: string; value: unknown }[];
                      const answer = answers.find((a) => a.questionId === q.id);
                      const value = answer?.value;
                      return Array.isArray(value) ? value.includes(option) : value === option;
                    }).length;
                    return (
                      <li key={option}>
                        {option}: {count}件
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}

          {canEdit && unresponded.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                未回答: {unresponded.map((r) => `${r.applicant.last_name} ${r.applicant.first_name}`).join("、")}
              </p>
              <RemindButton surveyId={survey.id} />
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <div>
          <DeleteButton id={survey.id} action={deleteSurvey} confirmText="このアンケートを削除しますか?" />
        </div>
      )}
    </div>
  );
}
