"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { recordAuditLog } from "@/lib/audit-log";
import type { AuditAction, SelectionResult, StageType } from "@/generated/prisma/client";

/** ステージ区分に応じて監査ログの重み付け(内定/承諾)を決める(FR088)。 */
function auditActionForStageType(stageType: StageType): AuditAction {
  if (stageType === "offer") return "offer";
  if (stageType === "acceptance") return "acceptance";
  return "status_change";
}

export async function advanceStage(selectionId: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

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
  await recordAuditLog({
    staffId: staff.id,
    action: auditActionForStageType(nextStage.stage_type),
    targetType: "Selection",
    targetId: selectionId,
    beforeValue: { stage_id: selection.current_stage_id },
    afterValue: { stage_id: nextStage.id },
  });

  revalidatePath("/selections");
}

/** カンバン表示でのドラッグ&ドロップによる任意ステージへの移動(FR011)。 */
export async function moveToStage(selectionId: string, toStageId: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const selection = await prisma.selection.findUniqueOrThrow({ where: { id: selectionId } });
  if (selection.current_stage_id === toStageId) return;

  const toStage = await prisma.selectionStage.findUniqueOrThrow({ where: { id: toStageId } });

  await prisma.$transaction([
    prisma.selection.update({
      where: { id: selectionId },
      data: { current_stage_id: toStageId },
    }),
    prisma.selectionHistory.create({
      data: {
        selection_id: selectionId,
        from_stage_id: selection.current_stage_id,
        to_stage_id: toStageId,
        changed_by: staff.id,
      },
    }),
  ]);
  await recordAuditLog({
    staffId: staff.id,
    action: auditActionForStageType(toStage.stage_type),
    targetType: "Selection",
    targetId: selectionId,
    beforeValue: { stage_id: selection.current_stage_id },
    afterValue: { stage_id: toStageId },
  });

  revalidatePath("/selections");
}

export async function setResult(selectionId: string, result: SelectionResult) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const selection = await prisma.selection.update({
    where: { id: selectionId },
    data: { result },
  });
  await recordAuditLog({
    staffId: staff.id,
    action: "status_change",
    targetType: "Selection",
    targetId: selectionId,
    afterValue: { result: selection.result },
  });

  revalidatePath("/selections");
}

/** FR097: 複数の応募者に対して選考結果を一括登録する。 */
export async function bulkSetResult(selectionIds: string[], result: SelectionResult) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);
  if (selectionIds.length === 0) throw new Error("対象を選択してください");

  await prisma.selection.updateMany({
    where: { id: { in: selectionIds } },
    data: { result },
  });
  await Promise.all(
    selectionIds.map((selectionId) =>
      recordAuditLog({
        staffId: staff.id,
        action: "status_change",
        targetType: "Selection",
        targetId: selectionId,
        afterValue: { result },
      })
    )
  );

  revalidatePath("/selections");
}
