import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  getQrCodeBreakdown,
  getSchoolBreakdown,
  getOfferAndAcceptanceSelections,
  parseFromDate,
  parseToDate,
} from "@/lib/analytics";

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const staff = await getCurrentStaff();
  if (!staff || !canViewAnalytics(staff)) {
    redirect("/");
  }
  const positionType = restrictedPositionType(staff);

  const params = await searchParams;
  const fromRaw = typeof params.from === "string" ? params.from : undefined;
  const toRaw = typeof params.to === "string" ? params.to : undefined;
  const filters = { positionType, from: parseFromDate(fromRaw), to: parseToDate(toRaw) };

  const [funnel, mediaBreakdown, qrCodeBreakdown, schoolBreakdown, offerSelections] =
    await Promise.all([
      getFunnelData(filters),
      getMediaBreakdown(filters),
      getQrCodeBreakdown(filters),
      getSchoolBreakdown(filters),
      getOfferAndAcceptanceSelections(filters),
    ]);

  const maxFunnelCount = Math.max(1, ...funnel.map((f) => f.count));
  const maxMediaCount = Math.max(1, ...mediaBreakdown.map((m) => m.count));

  const periodQuery = new URLSearchParams({
    ...(fromRaw ? { from: fromRaw } : {}),
    ...(toRaw ? { to: toRaw } : {}),
  }).toString();
  const offersExportHref = periodQuery
    ? `/api/export/offers?${periodQuery}`
    : "/api/export/offers";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">分析・レポート</h1>
          <p className="text-sm text-muted-foreground">
            基本的な選考ファネル・流入経路の可視化です(FR050-053)。各数値から学生一覧へドリルダウンできます(FR102)。
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/api/export/applicants">全応募者CSVエクスポート</a>
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">集計期間(FR103)</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from">開始日</Label>
              <Input id="from" name="from" type="date" defaultValue={fromRaw ?? ""} className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to">終了日</Label>
              <Input id="to" name="to" type="date" defaultValue={toRaw ?? ""} className="w-40" />
            </div>
            <Button type="submit">絞り込む</Button>
            {/* 未制御な入力値を確実にリセットするためプレーンな<a>でハードリロードする。 */}
            <a href="/analytics">
              <Button type="button" variant="outline">
                クリア
              </Button>
            </a>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">選考ファネル</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {funnel.length === 0 && (
            <p className="text-sm text-muted-foreground">選考フローが未設定です</p>
          )}
          {funnel.map((stage) => (
            <Link
              key={stage.stageId}
              href={`/applicants?stage_id=${stage.stageId}`}
              className="flex items-center gap-3 rounded-md px-1 py-0.5 hover:bg-secondary"
            >
              <span className="w-28 shrink-0 text-sm">{stage.stageName}</span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-secondary">
                <div
                  className="h-full rounded bg-primary"
                  style={{ width: `${(stage.count / maxFunnelCount) * 100}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-sm font-medium underline">
                {stage.count}
              </span>
              <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                {stage.conversionFromPrev === null ? "—" : `${stage.conversionFromPrev}%`}
              </span>
            </Link>
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
              <Link
                key={media.id}
                href={`/applicants?media_id=${media.id}`}
                className="flex items-center gap-3 rounded-md px-1 py-0.5 hover:bg-secondary"
              >
                <span className="w-28 shrink-0 truncate text-sm">{media.name}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-secondary">
                  <div
                    className="h-full rounded bg-primary"
                    style={{ width: `${(media.count / maxMediaCount) * 100}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-medium underline">
                  {media.count}
                </span>
                <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
                  {media.acceptanceRate === null ? "—" : `承諾${media.acceptanceRate}%`}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">QRコード別流入数・承諾率(FR042)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {qrCodeBreakdown.length === 0 && (
              <p className="text-sm text-muted-foreground">QRコード経由の流入データがまだありません</p>
            )}
            {qrCodeBreakdown.map((qrCode) => (
              <div key={qrCode.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{qrCode.label}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">流入{qrCode.entryCount}名</Badge>
                  <Badge variant="outline">
                    {qrCode.acceptanceRate === null ? "—" : `承諾${qrCode.acceptanceRate}%`}
                  </Badge>
                </div>
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
              <Link
                key={school.id}
                href={`/applicants?school_id=${school.id}`}
                className="flex items-center justify-between rounded-md px-1 py-0.5 text-sm hover:bg-secondary"
              >
                <span className="truncate">{school.name}</span>
                <Badge variant="secondary">{school.count}名</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">内定者・承諾者一覧</CardTitle>
          <Button asChild variant="outline" size="sm">
            <a href={offersExportHref}>CSVエクスポート</a>
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
                    <Link
                      href={`/applicants/${selection.applicant.id}`}
                      className="hover:underline"
                    >
                      {selection.applicant.last_name} {selection.applicant.first_name}
                    </Link>
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
