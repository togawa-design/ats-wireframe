"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import type { StageType } from "@/generated/prisma/client";

/// FR010: 選考フローのステージ構成を自由に設計できるようにする(MVPでは単一フロー)。

export async function addStage(formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const flow_id = String(formData.get("flow_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const stage_type = String(formData.get("stage_type") ?? "") as StageType;
  if (!flow_id) throw new Error("選考フローを指定してください");
  if (!name) throw new Error("ステージ名を入力してください");

  const lastStage = await prisma.selectionStage.findFirst({
    where: { flow_id },
    orderBy: { order: "desc" },
  });
  const nextOrder = (lastStage?.order ?? 0) + 1;

  await prisma.selectionStage.create({
    data: { flow_id, name, stage_type, order: nextOrder },
  });

  revalidatePath("/masters/selection-flows");
}

export async function renameStage(stageId: string, name: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);
  if (!name.trim()) throw new Error("ステージ名を入力してください");

  await prisma.selectionStage.update({ where: { id: stageId }, data: { name: name.trim() } });
  revalidatePath("/masters/selection-flows");
}

export async function changeStageType(stageId: string, stage_type: StageType) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  await prisma.selectionStage.update({ where: { id: stageId }, data: { stage_type } });
  revalidatePath("/masters/selection-flows");
}

export async function moveStage(stageId: string, direction: "up" | "down") {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const stage = await prisma.selectionStage.findUniqueOrThrow({ where: { id: stageId } });
  const neighbor = await prisma.selectionStage.findFirst({
    where: {
      flow_id: stage.flow_id,
      order: direction === "up" ? { lt: stage.order } : { gt: stage.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return; // 既に端にある場合は何もしない

  await prisma.$transaction([
    prisma.selectionStage.update({ where: { id: stage.id }, data: { order: neighbor.order } }),
    prisma.selectionStage.update({ where: { id: neighbor.id }, data: { order: stage.order } }),
  ]);

  revalidatePath("/masters/selection-flows");
}

export async function deleteStage(stageId: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  try {
    await prisma.selectionStage.delete({ where: { id: stageId } });
  } catch {
    throw new Error("このステージは使用中のため削除できません");
  }

  revalidatePath("/masters/selection-flows");
}
