"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { recordAuditLog } from "@/lib/audit-log";
import type { CallStatus } from "@/generated/prisma/client";

/** FR109: 応募者詳細画面から架電履歴(日時・結果・内容)を手動記録する(1学生に複数件登録可)。 */
export async function createCallLog(applicantId: string, formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const calledAtRaw = String(formData.get("called_at") ?? "");
  const result = String(formData.get("result") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!calledAtRaw) throw new Error("架電日時を入力してください");
  if (!result) throw new Error("架電結果を選択してください");

  const calledAt = new Date(calledAtRaw);
  if (Number.isNaN(calledAt.getTime())) throw new Error("架電日時が不正です");

  await prisma.callLog.create({
    data: {
      applicant_id: applicantId,
      staff_id: staff.id,
      called_at: calledAt,
      result,
      note: note || null,
    },
  });
  await recordAuditLog({
    staffId: staff.id,
    action: "edit_applicant",
    targetType: "Applicant",
    targetId: applicantId,
    afterValue: { call_log: { called_at: calledAtRaw, result } },
  });

  revalidatePath(`/applicants/${applicantId}`);
}

/** FR110: 要架電フラグ(call_status)を更新する。 */
export async function updateApplicantCallStatus(applicantId: string, callStatus: CallStatus) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  await prisma.applicant.update({
    where: { id: applicantId },
    data: { call_status: callStatus },
  });
  await recordAuditLog({
    staffId: staff.id,
    action: "edit_applicant",
    targetType: "Applicant",
    targetId: applicantId,
    afterValue: { call_status: callStatus },
  });

  revalidatePath(`/applicants/${applicantId}`);
  revalidatePath("/applicants");
}
