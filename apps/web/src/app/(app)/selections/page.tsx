import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdvanceButton } from "./advance-button";
import { ResultSelect } from "./result-select";
import { RESULT_LABELS } from "./result-labels";
import { getCurrentStaff } from "@/lib/auth";
import { canManage, isRestrictedToOwnApplicants } from "@/lib/permissions";

export default async function SelectionsPage() {
  const staff = await getCurrentStaff();
  const canEdit = staff ? canManage(staff) : false;
  const restrictToOwn = staff ? isRestrictedToOwnApplicants(staff) : false;

  const selections = await prisma.selection.findMany({
    where: restrictToOwn ? { assigned_to: staff!.id } : undefined,
    include: {
      applicant: true,
      current_stage: true,
      flow: { include: { stages: { orderBy: { order: "asc" } } } },
      assignee: true,
    },
    orderBy: { applicant: { created_at: "desc" } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">選考管理</h1>
        <p className="text-sm text-muted-foreground">
          応募者ごとの選考ステージと結果を管理します。応募登録時にデフォルトの選考フローで自動的に選考レコードが作成されます。
        </p>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>応募者</TableHead>
                <TableHead>現在のステージ</TableHead>
                <TableHead>結果</TableHead>
                <TableHead>担当者</TableHead>
                {canEdit && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {selections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 5 : 4} className="text-center text-muted-foreground">
                    選考中の応募者がいません
                  </TableCell>
                </TableRow>
              )}
              {selections.map((selection) => {
                const isLastStage =
                  selection.flow.stages.at(-1)?.id === selection.current_stage_id;
                return (
                  <TableRow key={selection.id}>
                    <TableCell>
                      {selection.applicant.last_name} {selection.applicant.first_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{selection.current_stage.name}</Badge>
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <ResultSelect selectionId={selection.id} value={selection.result} />
                      ) : (
                        <Badge variant="outline">{RESULT_LABELS[selection.result]}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {selection.assignee?.name ?? "—"}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        {!isLastStage && <AdvanceButton selectionId={selection.id} />}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
