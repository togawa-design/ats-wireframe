import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { canManage } from "@/lib/permissions";
import { ImportForm } from "./import-form";

export default async function MediaImportPage({ params }: PageProps<"/masters/media/[id]/import">) {
  const { id } = await params;

  const staff = await getCurrentStaff();
  if (!staff || !canManage(staff)) redirect("/masters/media");

  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">{media.name} - CSV取込</h1>
        <p className="text-sm text-muted-foreground">
          CSVをアップロードすると列名から項目マッピングを自動検出します。内容を確認・修正してから取り込んでください。
        </p>
      </div>
      <ImportForm mediaId={media.id} />
    </div>
  );
}
