import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
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
import { createQRCode, deleteQRCode } from "./actions";
import { DeleteButton } from "@/components/delete-button";
import { getCurrentStaff } from "@/lib/auth";
import { canManage } from "@/lib/permissions";

export default async function QRCodesPage() {
  const staff = await getCurrentStaff();
  const canEdit = staff ? canManage(staff) : false;

  const [qrCodes, tags, headersList] = await Promise.all([
    prisma.qRCode.findMany({ orderBy: { label: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    headers(),
  ]);

  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host");
  const origin = host ? `${protocol}://${host}` : "";
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">QRコードマスター</h1>
        <p className="text-sm text-muted-foreground">
          学校説明会などで配布するQRコードを発行します(FR041: QR発行まで。自動タグ付与は今後のSTEPで対応予定)。
        </p>
      </div>

      {canEdit && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">新規QRコード発行</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createQRCode} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="label">ラベル</Label>
                  <Input id="label" name="label" placeholder="例: 〇〇大学説明会" required className="w-56" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="liff_url">遷移先URL</Label>
                  <Input
                    id="liff_url"
                    name="liff_url"
                    type="url"
                    placeholder="https://..."
                    required
                    className="w-80"
                  />
                </div>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label>自動付与タグ(将来の自動タグ付けで利用予定)</Label>
                  <div className="flex flex-wrap gap-3">
                    {tags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-1.5 text-sm">
                        <input type="checkbox" name="auto_tags" value={tag.id} />
                        <Badge style={{ backgroundColor: tag.color, color: "#fff" }}>{tag.name}</Badge>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Button type="submit">発行</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>QRコード</TableHead>
                <TableHead>ラベル</TableHead>
                <TableHead>遷移先URL</TableHead>
                <TableHead>自動付与タグ</TableHead>
                <TableHead className="text-right">スキャン数</TableHead>
                {canEdit && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {qrCodes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 6 : 5} className="text-center text-muted-foreground">
                    QRコードがまだ登録されていません
                  </TableCell>
                </TableRow>
              )}
              {qrCodes.map((qr) => {
                const autoTagIds = Array.isArray(qr.auto_tags) ? (qr.auto_tags as string[]) : [];
                return (
                  <TableRow key={qr.id}>
                    <TableCell>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/qr/${qr.id}/image`}
                        alt={`${qr.label}のQRコード`}
                        width={80}
                        height={80}
                        className="rounded-md border border-border bg-white p-1"
                      />
                    </TableCell>
                    <TableCell>{qr.label}</TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                      <div>{qr.liff_url}</div>
                      <a
                        href={`${origin}/api/qr/${qr.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground underline"
                      >
                        {origin}/api/qr/{qr.id}
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {autoTagIds.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        {autoTagIds.map((tagId) => {
                          const tag = tagById.get(tagId);
                          if (!tag) return null;
                          return (
                            <Badge key={tagId} style={{ backgroundColor: tag.color, color: "#fff" }}>
                              {tag.name}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{qr.scan_count}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <DeleteButton id={qr.id} action={deleteQRCode} confirmText="このQRコードを削除しますか?" />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
