"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertIsAdmin } from "@/lib/permissions";
import type { StaffPositionAccess, StaffRole } from "@/generated/prisma/client";

/**
 * FR087 ユーザー管理画面。実際のメール送信基盤が無いため「招待メール送付」は
 * 対象外とし、管理者がemail/ロールを指定してStaffレコードを事前作成する
 * (本人が初回Googleログインした時点でgoogle_idが同期される。src/app/api/auth/session参照)。
 */
export async function inviteStaff(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertIsAdmin(staff);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "viewer") as StaffRole;
  const positionTypeAccess = String(formData.get("position_type_access") ?? "both") as StaffPositionAccess;
  if (!name) throw new Error("氏名を入力してください");
  if (!email) throw new Error("メールアドレスを入力してください");

  await prisma.staff.create({
    data: {
      name,
      email,
      role,
      position_type_access: positionTypeAccess,
      google_id: `pending:${email}`,
    },
  });

  revalidatePath("/users");
}

export async function updateStaffRole(staffId: string, role: StaffRole) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertIsAdmin(staff);
  if (staff.id === staffId) throw new Error("自分自身のロールは変更できません");

  await prisma.staff.update({ where: { id: staffId }, data: { role } });
  revalidatePath("/users");
}

/** FR095: スタッフの職種区分アクセス範囲(総合職/技能職/全職種)を変更する。 */
export async function updateStaffPositionAccess(staffId: string, access: StaffPositionAccess) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertIsAdmin(staff);

  await prisma.staff.update({ where: { id: staffId }, data: { position_type_access: access } });
  revalidatePath("/users");
}

export async function toggleStaffActive(staffId: string, isActive: boolean) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertIsAdmin(staff);
  if (staff.id === staffId) throw new Error("自分自身のアカウントは停止できません");

  await prisma.staff.update({ where: { id: staffId }, data: { is_active: isActive } });
  revalidatePath("/users");
}
