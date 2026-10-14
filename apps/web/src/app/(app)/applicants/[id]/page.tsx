import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { canManage, isRestrictedToOwnApplicants } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadApplicantDocument } from "./actions";

const APPLICANT_TYPE_LABELS: Record<string, string> = {
  new_grad: "新卒",
  existing_grad: "既卒",
  second_grad: "第二新卒",
};

const HIRE_TYPE_LABELS: Record<string, string> = {
  new_grad: "新卒",
  mid_career: "中途",
};

export default async function ApplicantDetailPage({ params }: PageProps<"/applicants/[id]">) {
  const { id } = await params;

  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  const canEdit = canManage(staff);
  const restrictToOwn = isRestrictedToOwnApplicants(staff);

  const applicant = await prisma.applicant.findFirst({
    where: restrictToOwn ? { id, selection: { assigned_to: staff.id } } : { id },
    include: {
      school: true,
      tags: { include: { tag: true } },
      selection: { include: { current_stage: true } },
    },
  });
  if (!applicant) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/applicants" className="text-sm text-muted-foreground hover:underline">
          ← 応募者一覧に戻る
        </Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">
          {applicant.last_name} {applicant.first_name}
        </h1>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <InfoRow label="メールアドレス" value={applicant.email} />
          <InfoRow label="電話番号" value={applicant.phone ?? "—"} />
          <InfoRow label="学校" value={applicant.school?.name ?? "—"} />
          <InfoRow label="学部・学科" value={applicant.department ?? "—"} />
          <InfoRow
            label="区分"
            value={
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">{HIRE_TYPE_LABELS[applicant.hire_type]}</Badge>
                <Badge variant="outline">{APPLICANT_TYPE_LABELS[applicant.applicant_type]}</Badge>
              </div>
            }
          />
          <InfoRow label="現在のステージ" value={applicant.selection?.current_stage.name ?? "—"} />
          <InfoRow
            label="タグ"
            value={
              applicant.tags.length === 0 ? (
                "—"
              ) : (
                <div className="flex flex-wrap gap-1">
                  {applicant.tags.map(({ tag }) => (
                    <Badge key={tag.id} style={{ backgroundColor: tag.color, color: "#fff" }}>
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )
            }
          />
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">書類(FR005)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DocumentRow
            label="エントリーシート"
            note="PDF・5MB以下"
            accept="application/pdf"
            kind="resume"
            url={applicant.resume_url}
            canEdit={canEdit}
            uploadAction={uploadApplicantDocument.bind(null, applicant.id)}
          />
          <DocumentRow
            label="証明写真"
            note="JPG・5MB以下"
            accept="image/jpeg"
            kind="photo"
            url={applicant.photo_url}
            canEdit={canEdit}
            uploadAction={uploadApplicantDocument.bind(null, applicant.id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function DocumentRow({
  label,
  note,
  accept,
  kind,
  url,
  canEdit,
  uploadAction,
}: {
  label: string;
  note: string;
  accept: string;
  kind: "resume" | "photo";
  url: string | null;
  canEdit: boolean;
  uploadAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div
      data-testid={`document-row-${kind}`}
      className="flex flex-wrap items-center gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
    >
      <div className="min-w-[160px]">
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      {url ? (
        <>
          <Badge variant="secondary">提出済み</Badge>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            表示・ダウンロード
          </a>
        </>
      ) : (
        <Badge variant="outline">未提出</Badge>
      )}
      {canEdit && (
        <form action={uploadAction} className="ml-auto flex items-center gap-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="file" name="file" accept={accept} required className="text-xs" />
          <Button type="submit" variant="outline" size="sm">
            アップロード
          </Button>
        </form>
      )}
    </div>
  );
}
