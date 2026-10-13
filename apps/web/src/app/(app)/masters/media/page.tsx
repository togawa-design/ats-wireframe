import Link from "next/link";
import { prisma } from "@/lib/prisma";
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
import { createMedia, deleteMedia } from "./actions";
import { DeleteButton } from "@/components/delete-button";
import { getCurrentStaff } from "@/lib/auth";
import { canManage } from "@/lib/permissions";

export default async function MediaPage() {
  const staff = await getCurrentStaff();
  const canEdit = staff ? canManage(staff) : false;

  const mediaList = await prisma.media.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">求人媒体マスター</h1>
        <p className="text-sm text-muted-foreground">
          必須6媒体: マイナビ / Re就活キャンパス / OfferBox / キミスカ / キャリアチケット / ABABA
        </p>
      </div>

      {canEdit && (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">新規媒体追加</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createMedia} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">媒体名</Label>
              <Input id="name" name="name" placeholder="例: マイナビ" required className="w-48" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sync_type">連携方式</Label>
              <select
                id="sync_type"
                name="sync_type"
                required
                className="h-9 w-28 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="csv">CSV</option>
                <option value="api">API</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost">月額費用(円)</Label>
              <Input id="cost" name="cost" type="number" placeholder="任意" className="w-32" />
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
                <TableHead>媒体名</TableHead>
                <TableHead>連携方式</TableHead>
                <TableHead>月額費用</TableHead>
                {canEdit && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {mediaList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 4 : 3} className="text-center text-muted-foreground">
                    媒体がまだ登録されていません
                  </TableCell>
                </TableRow>
              )}
              {mediaList.map((media) => (
                <TableRow key={media.id}>
                  <TableCell>{media.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground uppercase">
                    {media.sync_type}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {media.cost ? `¥${media.cost.toLocaleString()}` : "—"}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/masters/media/${media.id}/import`}>CSV取込</Link>
                        </Button>
                        <DeleteButton id={media.id} action={deleteMedia} confirmText="この媒体を削除しますか?" />
                      </div>
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
