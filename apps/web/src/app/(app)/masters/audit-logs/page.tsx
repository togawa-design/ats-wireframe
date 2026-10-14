import { redirect } from "next/navigation";
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
import { getCurrentStaff } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

const ACTION_LABELS: Record<string, string> = {
  login: "ログイン",
  logout: "ログアウト",
  export: "データエクスポート",
  status_change: "選考ステータス変更",
  offer: "内定",
  acceptance: "承諾",
  line_send: "LINE一斉送信",
  edit_applicant: "応募者情報編集",
  document_export: "書類出力",
};

export default async function AuditLogsPage() {
  const staff = await getCurrentStaff();
  if (!staff || !isAdmin(staff)) {
    redirect("/");
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { created_at: "desc" },
    take: 100,
    include: { staff: { select: { name: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">監査ログ(FR088)</h1>
        <p className="text-sm text-muted-foreground">
          重要操作(ログイン/ログアウト・データエクスポート・選考ステータス変更・内定/承諾・LINE一斉送信・応募者情報編集)の記録です。管理者のみ閲覧できます。直近100件を表示します。
        </p>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日時</TableHead>
                <TableHead>担当者</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>対象</TableHead>
                <TableHead>IPアドレス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    監査ログがまだありません
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("ja-JP", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    }).format(log.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">{log.staff.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ACTION_LABELS[log.action] ?? log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.target_type ? `${log.target_type}${log.target_id ? ` (${log.target_id})` : ""}` : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.ip_address}
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
