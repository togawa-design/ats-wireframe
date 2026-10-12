import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function QRCodesPage() {
  const qrCodes = await prisma.qRCode.findMany({ orderBy: { label: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">QRコードマスター</h1>
        <p className="text-sm text-muted-foreground">
          学校説明会などで配布するQRコードの発行状況を確認します（発行フォームは今後実装予定）。
        </p>
      </div>

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ラベル</TableHead>
                <TableHead>LIFF URL</TableHead>
                <TableHead className="text-right">スキャン数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {qrCodes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    QRコードがまだ登録されていません
                  </TableCell>
                </TableRow>
              )}
              {qrCodes.map((qr) => (
                <TableRow key={qr.id}>
                  <TableCell>{qr.label}</TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                    {qr.liff_url}
                  </TableCell>
                  <TableCell className="text-right">{qr.scan_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
