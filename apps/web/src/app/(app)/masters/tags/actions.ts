"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";

const DEFAULT_COLOR = "#2E6480";

export async function createTag(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");

  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? DEFAULT_COLOR).trim();
  if (!name) throw new Error("タグ名を入力してください");

  await prisma.tag.create({
    data: { name, color, created_by: staff.id },
  });

  revalidatePath("/masters/tags");
}

export async function deleteTag(id: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");

  await prisma.tag.delete({ where: { id } });
  revalidatePath("/masters/tags");
}
