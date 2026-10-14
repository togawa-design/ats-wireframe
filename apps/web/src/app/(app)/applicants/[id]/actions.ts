"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { uploadApplicantFile } from "@/lib/firebase/storage";
import { recordAuditLog } from "@/lib/audit-log";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES: Record<"resume" | "photo", string[]> = {
  resume: ["application/pdf"],
  photo: ["image/jpeg"],
};

/** FR005: 応募者詳細画面からのスタッフによる書類・証明写真の代理アップロード。 */
export async function uploadApplicantDocument(applicantId: string, formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const kind = String(formData.get("kind") ?? "");
  const file = formData.get("file");

  if (kind !== "resume" && kind !== "photo") {
    throw new Error("kindが不正です");
  }
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("ファイルを選択してください");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("ファイルサイズは5MB以下にしてください");
  }
  if (!ALLOWED_CONTENT_TYPES[kind].includes(file.type)) {
    throw new Error(kind === "resume" ? "PDFファイルを選択してください" : "JPG画像を選択してください");
  }

  const url = await uploadApplicantFile(applicantId, kind, file);

  await prisma.applicant.update({
    where: { id: applicantId },
    data: kind === "resume" ? { resume_url: url } : { photo_url: url },
  });
  await recordAuditLog({
    staffId: staff.id,
    action: "edit_applicant",
    targetType: "Applicant",
    targetId: applicantId,
    afterValue: { kind, url },
  });

  revalidatePath(`/applicants/${applicantId}`);
}
