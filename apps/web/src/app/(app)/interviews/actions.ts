"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanRecordInterview, assertCanDeleteInterview } from "@/lib/permissions";

export async function createInterview(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanRecordInterview(staff);

  const selection_id = String(formData.get("selection_id") ?? "");
  const interviewer_id = String(formData.get("interviewer_id") ?? "");
  const scheduledAtRaw = String(formData.get("scheduled_at") ?? "");
  if (!selection_id) throw new Error("応募者(選考)を選択してください");
  if (!interviewer_id) throw new Error("面接官を選択してください");
  if (!scheduledAtRaw) throw new Error("面接予定日時を入力してください");

  const scoreRaw = String(formData.get("score") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const selection = await prisma.selection.findUniqueOrThrow({
    where: { id: selection_id },
    select: { current_stage_id: true },
  });

  await prisma.interview.create({
    data: {
      selection_id,
      stage_id: selection.current_stage_id,
      interviewer_id,
      scheduled_at: new Date(scheduledAtRaw),
      score: scoreRaw ? Number(scoreRaw) : null,
      notes: notes || null,
    },
  });

  revalidatePath("/interviews");
}

export async function deleteInterview(id: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanDeleteInterview(staff);

  await prisma.interview.delete({ where: { id } });
  revalidatePath("/interviews");
}
