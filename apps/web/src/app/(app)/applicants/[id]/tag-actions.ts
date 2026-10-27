"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { syncApplicantRichMenu } from "@/lib/line/rich-menu-sync";

/**
 * 応募者のタグを編集する(これまで新規登録時にしか設定できなかった)。
 * FR035(リッチメニューのタグ連動自動切替)の前提として追加。
 */
export async function updateApplicantTags(applicantId: string, formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const tagIds = formData.getAll("tag_ids").map(String).filter(Boolean);

  await prisma.applicantTag.deleteMany({ where: { applicant_id: applicantId } });
  if (tagIds.length > 0) {
    await prisma.applicantTag.createMany({
      data: tagIds.map((tag_id) => ({ applicant_id: applicantId, tag_id, tagged_by: staff.id })),
    });
  }

  await syncApplicantRichMenu(applicantId);

  revalidatePath(`/applicants/${applicantId}`);
}
