"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import type { SelectionResult } from "@/generated/prisma/client";

export async function advanceStage(selectionId: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");

  const selection = await prisma.selection.findUniqueOrThrow({
    where: { id: selectionId },
    include: { flow: { include: { stages: { orderBy: { order: "asc" } } } } },
  });

  const stages = selection.flow.stages;
  const currentIndex = stages.findIndex((s) => s.id === selection.current_stage_id);
  const nextStage = stages[currentIndex + 1];
  if (!nextStage) throw new Error("既に最終ステージです");

  await prisma.$transaction([
    prisma.selection.update({
      where: { id: selectionId },
      data: { current_stage_id: nextStage.id },
    }),
    prisma.selectionHistory.create({
      data: {
        selection_id: selectionId,
        from_stage_id: selection.current_stage_id,
        to_stage_id: nextStage.id,
        changed_by: staff.id,
      },
    }),
  ]);

  revalidatePath("/selections");
}

export async function setResult(selectionId: string, result: SelectionResult) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");

  await prisma.selection.update({
    where: { id: selectionId },
    data: { result },
  });

  revalidatePath("/selections");
}
