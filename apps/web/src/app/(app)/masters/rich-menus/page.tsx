import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
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
import { canManage } from "@/lib/permissions";
import { RICH_MENU_LAYOUTS } from "@/lib/line/rich-menu-layouts";
import { CreateRichMenuForm } from "./create-form";

export default async function RichMenusPage() {
  const staff = await getCurrentStaff();
  const canEdit = staff ? canManage(staff) : false;

  const richMenus = await prisma.richMenu.findMany({
    include: { _count: { select: { rules: true } } },
    orderBy: [{ priority: "desc" }, { created_at: "desc" }],
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">リッチメニュー(FR034/035)</h1>
        <p className="text-sm text-muted-foreground">
          LINEのリッチメニューを作成・公開し、タグに応じて応募者ごとに自動で切り替えます。
          タグに一致するルールが無いメニューはLINE側の既定(フォールバック)メニューとして扱われます。
        </p>
      </div>

      {canEdit && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">新規作成</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateRichMenuForm />
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>レイアウト</TableHead>
                <TableHead>チャットバー</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>優先順位</TableHead>
                <TableHead>タグルール</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {richMenus.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    リッチメニューがまだ登録されていません
                  </TableCell>
                </TableRow>
              )}
              {richMenus.map((richMenu) => (
                <TableRow key={richMenu.id}>
                  <TableCell>
                    <Link href={`/masters/rich-menus/${richMenu.id}`} className="hover:underline">
                      {richMenu.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {RICH_MENU_LAYOUTS[richMenu.layout as keyof typeof RICH_MENU_LAYOUTS]?.label ??
                      richMenu.layout}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {richMenu.chat_bar_text}
                  </TableCell>
                  <TableCell>
                    <Badge variant={richMenu.status === "published" ? "default" : "outline"}>
                      {richMenu.status === "published" ? "公開中" : "下書き"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{richMenu.priority}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {richMenu._count.rules === 0 ? "既定(全員対象)" : `${richMenu._count.rules}件`}
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
