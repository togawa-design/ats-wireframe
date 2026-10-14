import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SendForm } from "./send-form";
import { getCurrentStaff } from "@/lib/auth";
import { canSendLine } from "@/lib/permissions";
import { getBroadcastHistory } from "@/lib/line/broadcast-history";

export default async function LineSendPage() {
  const staff = await getCurrentStaff();
  if (!staff || !canSendLine(staff)) {
    redirect("/");
  }

  const [tags, recipientCount, history] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.applicant.count({ where: { hire_type: "new_grad", line_user_id: { not: null } } }),
    getBroadcastHistory(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">LINEメッセージ送信</h1>
        <p className="text-sm text-muted-foreground">
          タグで絞り込んだ新卒応募者(LINE連携済み)にテキストメッセージを一斉送信します。中途応募者はLINE機能の対象外です。
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">
            現在LINE連携済みの新卒応募者: {recipientCount}名
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SendForm tags={tags} />
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">送信履歴(FR033)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>送信日時</TableHead>
                <TableHead>本文</TableHead>
                <TableHead>タグ</TableHead>
                <TableHead>送信者</TableHead>
                <TableHead className="text-right">対象数</TableHead>
                <TableHead className="text-right">送信数</TableHead>
                <TableHead className="text-right">開封数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    送信履歴がまだありません
                  </TableCell>
                </TableRow>
              )}
              {history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("ja-JP", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(item.sentAt)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">{item.templateText}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.tagName ?? "(全員)"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.senderName}
                  </TableCell>
                  <TableCell className="text-right">{item.recipientCount}</TableCell>
                  <TableCell className="text-right">{item.sentCount}</TableCell>
                  <TableCell className="text-right">{item.openedCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
