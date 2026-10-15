"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { parseColumnOrder, type ApplicantColumnKey } from "./columns";

/** FR099: 応募者一覧の表示列・並び順を担当者ごとに保存する。 */
export async function updateColumnPreference(columns: ApplicantColumnKey[]) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");

  const sanitized = parseColumnOrder(columns);

  await prisma.staffColumnPreference.upsert({
    where: { staff_id: staff.id },
    create: { staff_id: staff.id, columns: sanitized },
    update: { columns: sanitized },
  });

  revalidatePath("/applicants");
}
