import { prisma } from "@/lib/prisma";
import { RESULT_LABELS } from "./result-labels";
import { ViewToggle } from "./view-toggle";
import { KanbanBoard } from "./kanban-board";
import { SelectionsListView } from "./list-view";
import { getCurrentStaff } from "@/lib/auth";
import { canManage, isRestrictedToOwnApplicants, restrictedPositionType } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

export default async function SelectionsPage() {
  const staff = await getCurrentStaff();
  const canEdit = staff ? canManage(staff) : false;
  const restrictToOwn = staff ? isRestrictedToOwnApplicants(staff) : false;
  const positionType = staff ? restrictedPositionType(staff) : null;

  const conditions: Prisma.SelectionWhereInput[] = [];
  if (restrictToOwn) conditions.push({ assigned_to: staff!.id });
  // FR095: 職種区分によるアクセス制限(未設定の応募者は全員が閲覧可能)。
  if (positionType) {
    conditions.push({
      applicant: { OR: [{ position_type: positionType }, { position_type: null }] },
    });
  }

  const [selections, defaultFlow] = await Promise.all([
    prisma.selection.findMany({
      where: conditions.length > 0 ? { AND: conditions } : undefined,
      include: {
        applicant: true,
        current_stage: true,
        flow: { include: { stages: { orderBy: { order: "asc" } } } },
        assignee: true,
      },
      orderBy: { applicant: { created_at: "desc" } },
    }),
    prisma.selectionFlow.findFirst({
      where: { is_default: true },
      include: { stages: { orderBy: { order: "asc" } } },
    }),
  ]);

  const stages = defaultFlow?.stages ?? [];
  const kanbanCards = selections.map((selection) => ({
    id: selection.id,
    applicantName: `${selection.applicant.last_name} ${selection.applicant.first_name}`,
    stageId: selection.current_stage_id,
    resultLabel: RESULT_LABELS[selection.result],
    assigneeName: selection.assignee?.name ?? null,
  }));

  const listRows = selections.map((selection) => ({
    id: selection.id,
    applicantName: `${selection.applicant.last_name} ${selection.applicant.first_name}`,
    stageName: selection.current_stage.name,
    result: selection.result,
    assigneeName: selection.assignee?.name ?? null,
    isLastStage: selection.flow.stages.at(-1)?.id === selection.current_stage_id,
  }));
  const listView = <SelectionsListView selections={listRows} canEdit={canEdit} />;

  const kanbanView = canEdit ? (
    <KanbanBoard stages={stages} initialCards={kanbanCards} />
  ) : (
    <p className="text-sm text-muted-foreground">カンバンでの操作には編集権限が必要です。</p>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">選考管理</h1>
        <p className="text-sm text-muted-foreground">
          応募者ごとの選考ステージと結果を管理します(FR011)。カンバンではカードをドラッグしてステージを変更できます。
        </p>
      </div>

      <ViewToggle listView={listView} kanbanView={kanbanView} />
    </div>
  );
}
