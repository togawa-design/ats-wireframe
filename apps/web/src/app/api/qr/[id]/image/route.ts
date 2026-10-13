import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/** FR041: QRコード画像(PNG)を生成して返す。エンコード先はスキャン計測用のリダイレクトURL。 */
export async function GET(_req: Request, { params }: RouteContext<"/api/qr/[id]/image">) {
  const { id } = await params;

  const qrCode = await prisma.qRCode.findUnique({ where: { id } });
  if (!qrCode) {
    return NextResponse.json({ error: "QRコードが見つかりません" }, { status: 404 });
  }

  const headersList = await headers();
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host");
  const scanUrl = `${protocol}://${host}/api/qr/${id}`;

  const png = await QRCode.toBuffer(scanUrl, { type: "png", width: 300, margin: 1 });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
