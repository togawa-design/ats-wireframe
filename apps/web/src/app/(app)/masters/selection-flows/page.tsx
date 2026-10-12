import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STAGE_TYPE_LABELS: Record<string, string> = {
  entry: "エントリー",
  screening: "書類選考",
  interview_1st: "1次面接",
  interview_2nd: "2次面接",
  interview_final: "最終面接",
  offer: "内定",
  acceptance: "内定承諾",
};

export default async function SelectionFlowsPage() {
  const flows = await prisma.selectionFlow.findMany({
    include: { stages: { orderBy: { order: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">選考フロー</h1>
        <p className="text-sm text-muted-foreground">
          選考ステージの定義を確認します（編集フォームは今後実装予定）。
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
          <CardContent>
            <ol className="flex flex-wrap gap-2 text-sm">
              {flow.stages.map((stage) => (
                <li
                  key={stage.id}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1"
                >
                  <span className="text-muted-foreground">{stage.order}.</span>
                  {stage.name}
                  <span className="text-xs text-muted-foreground">
                    ({STAGE_TYPE_LABELS[stage.stage_type] ?? stage.stage_type})
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
