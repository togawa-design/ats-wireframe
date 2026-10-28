"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanSendLine } from "@/lib/permissions";
import { sendTextMessage, describeLineSendError } from "@/lib/line/client";
import { recordAuditLog } from "@/lib/audit-log";

export type SurveyActionResult = { ok: true } | { ok: false; error: string };
export type SurveySendResult =
  | { ok: true; successCount: number; failureCount: number; total: number }
  | { ok: false; error: string };

export type SurveyQuestionType = "text" | "single_choice" | "multi_choice";
export type SurveyQuestion = {
  id: string;
  type: SurveyQuestionType;
  label: string;
  options?: string[];
};

const QUESTION_TYPES: SurveyQuestionType[] = ["text", "single_choice", "multi_choice"];

/** FR036: アンケートを下書きとして作成する。 */
export async function createSurvey(formData: FormData): Promise<SurveyActionResult> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanSendLine(staff);

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title) return { ok: false, error: "タイトルを入力してください" };

  const questionCount = Number(formData.get("question_count") ?? 0);
  if (!Number.isInteger(questionCount) || questionCount < 1) {
    return { ok: false, error: "質問を1つ以上追加してください" };
  }

  const questions: SurveyQuestion[] = [];
  for (let i = 0; i < questionCount; i++) {
    const type = String(formData.get(`question_type_${i}`) ?? "");
    const label = String(formData.get(`question_label_${i}`) ?? "").trim();
    if (!label) return { ok: false, error: `質問${i + 1}の内容を入力してください` };
    if (!QUESTION_TYPES.includes(type as SurveyQuestionType)) {
      return { ok: false, error: `質問${i + 1}の回答形式を選択してください` };
    }

    if (type === "single_choice" || type === "multi_choice") {
      const options = String(formData.get(`question_options_${i}`) ?? "")
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean);
      if (options.length < 2) {
        return { ok: false, error: `質問${i + 1}の選択肢を2つ以上入力してください` };
      }
      questions.push({ id: `q${i + 1}`, type: type as SurveyQuestionType, label, options });
    } else {
      questions.push({ id: `q${i + 1}`, type: "text", label });
    }
  }

  await prisma.survey.create({
    data: { title, description: description || null, questions, status: "draft" },
  });

  revalidatePath("/masters/surveys");
  return { ok: true };
}

export async function deleteSurvey(id: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanSendLine(staff);

  await prisma.survey.delete({ where: { id } });
  revalidatePath("/masters/surveys");
}

/** 公開するとLIFFページから回答を受け付けられるようになり、送信対象にできる。 */
export async function publishSurvey(id: string): Promise<SurveyActionResult> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanSendLine(staff);

  await prisma.survey.update({ where: { id }, data: { status: "published" } });
  revalidatePath("/masters/surveys");
  revalidatePath(`/masters/surveys/${id}`);
  return { ok: true };
}

/** 送信済みの相手がいる場合、回答との整合性が崩れるため下書きには戻せない。 */
export async function unpublishSurvey(id: string): Promise<SurveyActionResult> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanSendLine(staff);

  const recipientCount = await prisma.surveyRecipient.count({ where: { survey_id: id } });
  if (recipientCount > 0) {
    return { ok: false, error: "送信済みのため下書きには戻せません" };
  }

  await prisma.survey.update({ where: { id }, data: { status: "draft" } });
  revalidatePath("/masters/surveys");
  revalidatePath(`/masters/surveys/${id}`);
  return { ok: true };
}

function buildLiffUrl(surveyId: string): string {
  const liffId = process.env.NEXT_PUBLIC_SURVEY_LIFF_ID;
  if (!liffId) throw new Error("NEXT_PUBLIC_SURVEY_LIFF_ID が設定されていません");
  return `https://liff.line.me/${liffId}?surveyId=${surveyId}`;
}

/**
 * FR036: タグで絞り込んだ応募者にアンケートのLIFFリンクを送信する。
 * 既に送信済みの応募者は対象から除く(再送はremindSurveyで行う)。
 * LINE機能は新卒のみ対象(FR115: 中途は非表示)。
 */
export async function sendSurvey(surveyId: string, formData: FormData): Promise<SurveySendResult> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanSendLine(staff);

  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) return { ok: false, error: "アンケートが見つかりません" };
  if (survey.status !== "published") {
    return { ok: false, error: "公開してから送信してください" };
  }

  let liffUrl: string;
  try {
    liffUrl = buildLiffUrl(surveyId);
  } catch (e) {
    return { ok: false, error: describeLineSendError(e) };
  }

  const tagId = String(formData.get("tag_id") ?? "") || undefined;
  const recipients = await prisma.applicant.findMany({
    where: {
      hire_type: "new_grad",
      line_user_id: { not: null },
      ...(tagId ? { tags: { some: { tag_id: tagId } } } : {}),
      survey_recipients: { none: { survey_id: surveyId } },
    },
    select: { id: true, line_user_id: true },
  });

  const text = `アンケート「${survey.title}」にご協力ください。\n${liffUrl}`;
  let successCount = 0;
  let failureCount = 0;

  for (const recipient of recipients) {
    try {
      // LINEのpush APIはレート制限があるため逐次送信する
      await sendTextMessage(recipient.line_user_id!, text);
      await prisma.surveyRecipient.create({
        data: { survey_id: surveyId, applicant_id: recipient.id },
      });
      successCount++;
    } catch {
      failureCount++;
    }
  }

  await recordAuditLog({
    staffId: staff.id,
    action: "line_send",
    targetType: "Survey",
    targetId: surveyId,
    afterValue: { recipient_count: recipients.length, sent_count: successCount },
  });

  revalidatePath(`/masters/surveys/${surveyId}`);
  return { ok: true, successCount, failureCount, total: recipients.length };
}

/** FR036: 未回答者だけにリマインドを再送する。 */
export async function remindSurvey(surveyId: string): Promise<SurveySendResult> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanSendLine(staff);

  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) return { ok: false, error: "アンケートが見つかりません" };

  let liffUrl: string;
  try {
    liffUrl = buildLiffUrl(surveyId);
  } catch (e) {
    return { ok: false, error: describeLineSendError(e) };
  }

  const unresponded = await prisma.surveyRecipient.findMany({
    where: { survey_id: surveyId, applicant: { survey_responses: { none: { survey_id: surveyId } } } },
    include: { applicant: { select: { id: true, line_user_id: true } } },
  });

  const text = `【リマインド】アンケート「${survey.title}」にまだご回答いただいていません。\n${liffUrl}`;
  let successCount = 0;
  let failureCount = 0;

  for (const recipient of unresponded) {
    try {
      await sendTextMessage(recipient.applicant.line_user_id!, text);
      await prisma.surveyRecipient.update({
        where: { id: recipient.id },
        data: { reminded_at: new Date() },
      });
      successCount++;
    } catch {
      failureCount++;
    }
  }

  revalidatePath(`/masters/surveys/${surveyId}`);
  return { ok: true, successCount, failureCount, total: unresponded.length };
}
