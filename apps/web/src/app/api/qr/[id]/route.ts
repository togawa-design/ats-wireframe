import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** FR041: QRコードのスキャン用リダイレクト。スキャン数を記録して遷移先URLへ転送する。 */
export async function GET(_req: Request, { params }: RouteContext<"/api/qr/[id]">) {
  const { id } = await params;

  const qrCode = await prisma.qRCode.update({
    where: { id },
    data: { scan_count: { increment: 1 } },
  }).catch(() => null);

  if (!qrCode) {
    return NextResponse.json({ error: "QRコードが見つかりません" }, { status: 404 });
  }

  return NextResponse.redirect(qrCode.liff_url);
}
