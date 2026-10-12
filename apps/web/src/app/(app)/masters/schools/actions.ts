"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import type { SchoolType } from "@/generated/prisma/client";

export async function createSchool(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as SchoolType;
  const category = String(formData.get("category") ?? "").trim();
  if (!name) throw new Error("学校名を入力してください");

  await prisma.school.create({
    data: { name, type, category: category || null },
  });

  revalidatePath("/masters/schools");
}

export async function deleteSchool(id: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");

  await prisma.school.delete({ where: { id } });
  revalidatePath("/masters/schools");
}
