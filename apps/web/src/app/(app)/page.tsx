import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentStaff } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/permissions";
import { getFunnelData } from "@/lib/analytics";

export default async function DashboardPage() {
  const staff = await getCurrentStaff();
  const showFunnel = staff ? canViewAnalytics(staff) : false;
  const funnel = showFunnel ? await getFunnelData() : [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-foreground">ダッシュボード</h1>
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">ようこそ、{staff?.name} さん</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          応募者管理・選考管理・面接記録・LINE連携・分析レポートまで実装済みです。
          左メニューの各項目からご利用ください。
        </CardContent>
      </Card>

      {showFunnel && funnel.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">選考ファネル(概要)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-4 text-sm">
              {funnel.map((stage) => (
                <div key={stage.stageId} className="flex items-baseline gap-1.5">
                  <span className="text-muted-foreground">{stage.stageName}</span>
                  <span className="font-semibold">{stage.count}</span>
                </div>
              ))}
            </div>
            <Link href="/analytics" className="text-xs text-primary hover:underline">
              詳細な分析・レポートを見る →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
