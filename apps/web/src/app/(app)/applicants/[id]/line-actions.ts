"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanSendLine } from "@/lib/permissions";
import { sendTextMessage, sendImageMessage, describeLineSendError } from "@/lib/line/client";
import { uploadLineMessageImage } from "@/lib/firebase/storage";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // LINE画像メッセージの上限

export type SendLineMessageResult = { ok: true } | { ok: false; error: string };

/**
 * FR032: 応募者詳細画面から1対1でLINEメッセージ(テキスト/画像)を送信する。
 * 失敗時は例外を投げず結果オブジェクトを返す。LINE APIのエラー(`HTTPFetchError`等、
 * シリアライズ不可なプロパティを持つ場合がある)を含め、例外をそのままクライアントの
 * Server Action呼び出し元まで伝播させないため。
 */
export async function sendApplicantLineMessage(
  applicantId: string,
  formData: FormData
): Promise<SendLineMessageResult> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanSendLine(staff);

  const applicant = await prisma.applicant.findUnique({
    where: { id: applicantId },
    select: { line_user_id: true, hire_type: true },
  });
  if (!applicant) throw new Error("応募者が見つかりません");
  if (applicant.hire_type !== "new_grad") {
    return { ok: false, error: "中途応募者はLINE機能の対象外です" };
  }
  if (!applicant.line_user_id) {
    return { ok: false, error: "LINE未連携の応募者です" };
  }

  const text = String(formData.get("text") ?? "").trim();
  const file = formData.get("file");

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return { ok: false, error: "画像サイズは10MB以下にしてください" };
    }
    if (file.type !== "image/jpeg") {
      return { ok: false, error: "JPG画像を選択してください" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadLineMessageImage(applicantId, buffer, file.type);
    try {
      await sendImageMessage(applicant.line_user_id, url);
    } catch (e) {
      return { ok: false, error: describeLineSendError(e) };
    }
    await prisma.lineMessage.create({
      data: {
        applicant_id: applicantId,
        direction: "outbound",
        message_type: "image",
        file_url: url,
      },
    });
  } else {
    if (!text) return { ok: false, error: "メッセージを入力するか、画像を選択してください" };

    try {
      await sendTextMessage(applicant.line_user_id, text);
    } catch (e) {
      return { ok: false, error: describeLineSendError(e) };
    }
    await prisma.lineMessage.create({
      data: {
        applicant_id: applicantId,
        direction: "outbound",
        message_type: "text",
        content: text,
      },
    });
  }

  revalidatePath(`/applicants/${applicantId}`);
  return { ok: true };
}
