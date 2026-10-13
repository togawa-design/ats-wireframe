"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanSendLine } from "@/lib/permissions";
import { sendTextMessage } from "@/lib/line/client";

function fillTemplate(template: string, applicant: { last_name: string; first_name: string }) {
  return template
    .replaceAll("{{last_name}}", applicant.last_name)
    .replaceAll("{{first_name}}", applicant.first_name);
}

/**
 * タグで絞り込んだ応募者にLINEメッセージを一斉送信する(FR031)。
 * LINE機能は新卒のみ対象(FR115: 中途は非表示)。
 */
export async function sendBulkLineMessage(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanSendLine(staff);

  const text = String(formData.get("text") ?? "").trim();
  if (!text) throw new Error("メッセージ本文を入力してください");

  const tag_id = String(formData.get("tag_id") ?? "") || undefined;

  const recipients = await prisma.applicant.findMany({
    where: {
      hire_type: "new_grad",
      line_user_id: { not: null },
      ...(tag_id ? { tags: { some: { tag_id } } } : {}),
    },
    select: { id: true, last_name: true, first_name: true, line_user_id: true },
  });

  let successCount = 0;
  let failureCount = 0;

  for (const recipient of recipients) {
    const content = fillTemplate(text, recipient);
    try {
      // LINEのpush APIはレート制限があるため逐次送信する
      await sendTextMessage(recipient.line_user_id!, content);
      await prisma.lineMessage.create({
        data: {
          applicant_id: recipient.id,
          direction: "outbound",
          message_type: "text",
          content,
        },
      });
      successCount++;
    } catch {
      failureCount++;
    }
  }

  revalidatePath("/line-send");
  return { successCount, failureCount, total: recipients.length };
}
