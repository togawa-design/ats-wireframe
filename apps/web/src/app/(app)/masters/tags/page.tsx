import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createTag, deleteTag } from "./actions";
import { DeleteButton } from "@/components/delete-button";
import { getCurrentStaff } from "@/lib/auth";
import { canManage } from "@/lib/permissions";

export default async function TagsPage() {
  const staff = await getCurrentStaff();
  const canEdit = staff ? canManage(staff) : false;

  const tags = await prisma.tag.findMany({
    include: { creator: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">タグマスター</h1>
        <p className="text-sm text-muted-foreground">
          応募者に付与するタグを管理します（例: &quot;マイナビ&quot;, &quot;理系&quot;）。
        </p>
      </div>

      {canEdit && (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">新規タグ追加</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createTag} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">タグ名</Label>
              <Input id="name" name="name" placeholder="例: 理系" required className="w-48" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="color">カラー</Label>
              <Input
                id="color"
                name="color"
                type="color"
                defaultValue="#2E6480"
                className="h-9 w-16 p-1"
              />
            </div>
            <Button type="submit">追加</Button>
          </form>
        </CardContent>
      </Card>
      )}

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>タグ</TableHead>
                <TableHead>カラー</TableHead>
                <TableHead>作成者</TableHead>
                {canEdit && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 4 : 3} className="text-center text-muted-foreground">
                    タグがまだ登録されていません
                  </TableCell>
                </TableRow>
              )}
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <Badge style={{ backgroundColor: tag.color, color: "#fff" }}>
                      {tag.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {tag.color}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tag.creator.name}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <DeleteButton id={tag.id} action={deleteTag} confirmText="このタグを削除しますか?" />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
