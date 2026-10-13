"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import type { ApplicantType, HireType, PositionType } from "@/generated/prisma/client";

const LINE_TOKEN_EXPIRES_IN_MS = 24 * 60 * 60 * 1000; // 24時間

export async function createApplicant(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const last_name = String(formData.get("last_name") ?? "").trim();
  const first_name = String(formData.get("first_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!last_name || !first_name) throw new Error("氏名を入力してください");
  if (!email) throw new Error("メールアドレスを入力してください");

  const school_id = String(formData.get("school_id") ?? "") || null;
  const graduationYearRaw = String(formData.get("graduation_year") ?? "").trim();
  const applicant_type = String(formData.get("applicant_type") ?? "new_grad") as ApplicantType;
  const hire_type = String(formData.get("hire_type") ?? "new_grad") as HireType;
  const positionTypeRaw = String(formData.get("position_type") ?? "");
  const tagIds = formData.getAll("tag_ids").map(String).filter(Boolean);

  const applicant = await prisma.applicant.create({
    data: {
      last_name,
      first_name,
      email,
      school_id,
      graduation_year: graduationYearRaw ? Number(graduationYearRaw) : null,
      applicant_type,
      hire_type,
      position_type: (positionTypeRaw || null) as PositionType | null,
    },
  });

  if (tagIds.length > 0) {
    await prisma.applicantTag.createMany({
      data: tagIds.map((tag_id) => ({
        applicant_id: applicant.id,
        tag_id,
        tagged_by: staff.id,
      })),
    });
  }

  // 応募登録と同時に、デフォルト選考フローの最初のステージでSelectionを作成する。
  const defaultFlow = await prisma.selectionFlow.findFirst({
    where: { is_default: true, is_active: true },
    include: { stages: { orderBy: { order: "asc" }, take: 1 } },
  });
  if (defaultFlow && defaultFlow.stages[0]) {
    await prisma.selection.create({
      data: {
        applicant_id: applicant.id,
        flow_id: defaultFlow.id,
        current_stage_id: defaultFlow.stages[0].id,
      },
    });
  }

  revalidatePath("/applicants");
  revalidatePath("/selections");
}

export async function deleteApplicant(id: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  await prisma.applicant.delete({ where: { id } });
  revalidatePath("/applicants");
}

/** LINE友だち登録・紐付け用のワンタイムトークンを発行する(FR030)。 */
export async function issueLineRegistrationToken(applicantId: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const token = randomBytes(32).toString("hex");
  await prisma.lineRegistrationToken.create({
    data: {
      token,
      applicant_id: applicantId,
      expires_at: new Date(Date.now() + LINE_TOKEN_EXPIRES_IN_MS),
    },
  });

  revalidatePath("/applicants");
}
