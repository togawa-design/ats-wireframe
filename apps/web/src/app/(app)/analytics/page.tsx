import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentStaff } from "@/lib/auth";
import { canViewAnalytics, restrictedPositionType } from "@/lib/permissions";
import {
  getFunnelData,
  getMediaBreakdown,
  getSchoolBreakdown,
  getOfferAndAcceptanceSelections,
} from "@/lib/analytics";

export default async function AnalyticsPage() {
  const staff = await getCurrentStaff();
  if (!staff || !canViewAnalytics(staff)) {
    redirect("/");
  }
  const positionType = restrictedPositionType(staff);

  const [funnel, mediaBreakdown, schoolBreakdown, offerSelections] = await Promise.all([
    getFunnelData(positionType),
    getMediaBreakdown(positionType),
    getSchoolBreakdown(positionType),
    getOfferAndAcceptanceSelections(positionType),
  ]);

  const maxFunnelCount = Math.max(1, ...funnel.map((f) => f.count));
  const maxMediaCount = Math.max(1, ...mediaBreakdown.map((m) => m.count));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">分析・レポート</h1>
          <p className="text-sm text-muted-foreground">
            基本的な選考ファネル・流入経路の可視化です(FR050-053)。
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/api/export/applicants">全応募者CSVエクスポート</a>
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">選考ファネル</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {funnel.length === 0 && (
            <p className="text-sm text-muted-foreground">選考フローが未設定です</p>
          )}
          {funnel.map((stage) => (
            <div key={stage.stageId} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm">{stage.stageName}</span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-secondary">
                <div
                  className="h-full rounded bg-primary"
                  style={{ width: `${(stage.count / maxFunnelCount) * 100}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-sm font-medium">{stage.count}</span>
              <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                {stage.conversionFromPrev === null ? "—" : `${stage.conversionFromPrev}%`}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">媒体別流入数</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {mediaBreakdown.every((m) => m.count === 0) && (
              <p className="text-sm text-muted-foreground">
                媒体経由の流入データがまだありません(CSV取込は別STEPで対応予定)
              </p>
            )}
            {mediaBreakdown.map((media) => (
              <div key={media.name} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm">{media.name}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-secondary">
                  <div
                    className="h-full rounded bg-primary"
                    style={{ width: `${(media.count / maxMediaCount) * 100}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-medium">{media.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">学校別流入数</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {schoolBreakdown.length === 0 && (
              <p className="text-sm text-muted-foreground">学校が登録された応募者がまだいません</p>
            )}
            {schoolBreakdown.map((school) => (
              <div key={school.name} className="flex items-center justify-between text-sm">
                <span className="truncate">{school.name}</span>
                <Badge variant="secondary">{school.count}名</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">内定者・承諾者一覧</CardTitle>
          <Button asChild variant="outline" size="sm">
            <a href="/api/export/offers">CSVエクスポート</a>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>応募者</TableHead>
                <TableHead>学校</TableHead>
                <TableHead>ステージ</TableHead>
                <TableHead>担当者</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offerSelections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    内定・内定承諾段階の応募者はいません
                  </TableCell>
                </TableRow>
              )}
              {offerSelections.map((selection) => (
                <TableRow key={selection.id}>
                  <TableCell>
                    {selection.applicant.last_name} {selection.applicant.first_name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {selection.applicant.school?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{selection.current_stage.name}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {selection.assignee?.name ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
