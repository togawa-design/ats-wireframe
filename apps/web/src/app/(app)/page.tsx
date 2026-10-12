import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentStaff } from "@/lib/auth";

export default async function DashboardPage() {
  const staff = await getCurrentStaff();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-foreground">ダッシュボード</h1>
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">ようこそ、{staff?.name} さん</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          STEP 0（認証基盤）・STEP 1（マスターデータ）の実装が完了しました。
          左メニューの「マスターデータ」から各マスターを管理できます。
          応募者一覧・選考管理などは STEP 2 以降で実装予定です。
        </CardContent>
      </Card>
    </div>
  );
}
