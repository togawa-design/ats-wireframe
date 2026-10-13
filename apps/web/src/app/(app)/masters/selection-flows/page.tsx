import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentStaff } from "@/lib/auth";
import { canManage } from "@/lib/permissions";
import { addStage } from "./actions";
import { StageRow } from "./stage-row";
import { STAGE_TYPE_LABELS } from "./stage-labels";

export default async function SelectionFlowsPage() {
  const staff = await getCurrentStaff();
  const canEdit = staff ? canManage(staff) : false;

  const flows = await prisma.selectionFlow.findMany({
    include: { stages: { orderBy: { order: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">選考フロー</h1>
        <p className="text-sm text-muted-foreground">
          選考ステージの構成を管理します(FR010)。複数フローの切り替えはPhase2以降で対応予定です。
        </p>
      </div>

      {flows.length === 0 && (
        <Card className="border-border">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            選考フローがまだ登録されていません
          </CardContent>
        </Card>
      )}

      {flows.map((flow) => (
        <Card key={flow.id} className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">{flow.name}</CardTitle>
            <div className="flex gap-1.5">
              {flow.is_default && <Badge variant="secondary">デフォルト</Badge>}
              {!flow.is_active && <Badge variant="destructive">無効</Badge>}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {canEdit ? (
              flow.stages.map((stage, index) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  isFirst={index === 0}
                  isLast={index === flow.stages.length - 1}
                />
              ))
            ) : (
              <ol className="flex flex-wrap gap-2 text-sm">
                {flow.stages.map((stage) => (
                  <li
                    key={stage.id}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1"
                  >
                    <span className="text-muted-foreground">{stage.order}.</span>
                    {stage.name}
                    <span className="text-xs text-muted-foreground">
                      ({STAGE_TYPE_LABELS[stage.stage_type]})
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {canEdit && (
              <form action={addStage} className="mt-2 flex flex-wrap items-end gap-3">
                <input type="hidden" name="flow_id" value={flow.id} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`name-${flow.id}`}>新規ステージ名</Label>
                  <Input id={`name-${flow.id}`} name="name" required className="w-40" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`stage_type-${flow.id}`}>種別</Label>
                  <select
                    id={`stage_type-${flow.id}`}
                    name="stage_type"
                    className="h-9 w-32 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {Object.entries(STAGE_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit">ステージ追加</Button>
              </form>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
