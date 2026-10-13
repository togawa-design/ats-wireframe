"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";

export async function createQRCode(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const label = String(formData.get("label") ?? "").trim();
  const liff_url = String(formData.get("liff_url") ?? "").trim();
  const auto_tags = formData.getAll("auto_tags").map(String).filter(Boolean);
  if (!label) throw new Error("ラベルを入力してください");
  if (!liff_url) throw new Error("遷移先URLを入力してください");

  await prisma.qRCode.create({
    data: { label, liff_url, auto_tags, scan_count: 0 },
  });

  revalidatePath("/masters/qrcodes");
}

export async function deleteQRCode(id: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  await prisma.qRCode.delete({ where: { id } });
  revalidatePath("/masters/qrcodes");
}
