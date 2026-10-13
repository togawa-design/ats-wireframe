"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import type { MediaSyncType } from "@/generated/prisma/client";

export async function createMedia(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const name = String(formData.get("name") ?? "").trim();
  const sync_type = String(formData.get("sync_type") ?? "") as MediaSyncType;
  const costRaw = String(formData.get("cost") ?? "").trim();
  if (!name) throw new Error("媒体名を入力してください");

  await prisma.media.create({
    data: {
      name,
      sync_type,
      cost: costRaw ? Number(costRaw) : null,
      field_mapping: {},
    },
  });

  revalidatePath("/masters/media");
}

export async function deleteMedia(id: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  await prisma.media.delete({ where: { id } });
  revalidatePath("/masters/media");
}
