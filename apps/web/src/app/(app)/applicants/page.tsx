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
import { createApplicant, deleteApplicant, issueLineRegistrationToken } from "./actions";
import { parseApplicantFilters, buildApplicantWhere } from "./filters";
import { DeleteButton } from "@/components/delete-button";
import { headers } from "next/headers";
import { getCurrentStaff } from "@/lib/auth";
import { canManage, isRestrictedToOwnApplicants } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

const APPLICANT_TYPE_LABELS: Record<string, string> = {
  new_grad: "新卒",
  existing_grad: "既卒",
  second_grad: "第二新卒",
};

const HIRE_TYPE_LABELS: Record<string, string> = {
  new_grad: "新卒",
  mid_career: "中途",
};

const POSITION_TYPE_LABELS: Record<string, string> = {
  sogo: "総合職",
  gino: "技能職",
};

export default async function ApplicantsPage({ searchParams }: PageProps<"/applicants">) {
  const staff = await getCurrentStaff();
  const canEdit = staff ? canManage(staff) : false;
  const restrictToOwn = staff ? isRestrictedToOwnApplicants(staff) : false;

  const filters = parseApplicantFilters(await searchParams);
  const filterWhere = buildApplicantWhere(filters);
  const where: Prisma.ApplicantWhereInput = restrictToOwn
    ? { AND: [filterWhere, { selection: { assigned_to: staff!.id } }] }
    : filterWhere;

  const [applicants, schools, tags, mediaList, defaultFlow, headersList] = await Promise.all([
    prisma.applicant.findMany({
      where,
      include: {
        school: true,
        tags: { include: { tag: true } },
        line_tokens: { orderBy: { created_at: "desc" }, take: 1 },
        selection: { include: { current_stage: true } },
      },
      orderBy: { created_at: "desc" },
    }),
    prisma.school.findMany({ orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.media.findMany({ orderBy: { name: "asc" } }),
    prisma.selectionFlow.findFirst({
      where: { is_default: true },
      include: { stages: { orderBy: { order: "asc" } } },
    }),
    headers(),
  ]);
  const stages = defaultFlow?.stages ?? [];

  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host");
  const origin = host ? `${protocol}://${host}` : "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">応募者一覧</h1>
        <p className="text-sm text-muted-foreground">
          応募者の基本情報を管理します。選考管理・LINE連携は今後のSTEPで追加予定です。
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">絞り込み検索(FR004)</CardTitle>
        </CardHeader>
        <CardContent>
          <form aria-label="絞り込み検索フォーム" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-q">キーワード</Label>
                <Input
                  id="filter-q"
                  name="q"
                  placeholder="氏名・カナで検索"
                  defaultValue={filters.q ?? ""}
                  className="w-48"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-school_id">学校</Label>
                <select
                  id="filter-school_id"
                  name="school_id"
                  defaultValue={filters.schoolId ?? ""}
                  className="h-9 w-44 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">(すべて)</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-stage_id">現在のステージ</Label>
                <select
                  id="filter-stage_id"
                  name="stage_id"
                  defaultValue={filters.stageId ?? ""}
                  className="h-9 w-36 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">(すべて)</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-media_id">媒体</Label>
                <select
                  id="filter-media_id"
                  name="media_id"
                  defaultValue={filters.mediaId ?? ""}
                  className="h-9 w-36 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">(すべて)</option>
                  {mediaList.map((media) => (
                    <option key={media.id} value={media.id}>
                      {media.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-applicant_type">応募者区分</Label>
                <select
                  id="filter-applicant_type"
                  name="applicant_type"
                  defaultValue={filters.applicantType ?? ""}
                  className="h-9 w-28 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">(すべて)</option>
                  {Object.entries(APPLICANT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>タグ</Label>
                <div className="flex flex-wrap gap-3">
                  {tags.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        name="tag_ids"
                        value={tag.id}
                        defaultChecked={filters.tagIds.includes(tag.id)}
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit">絞り込む</Button>
              <Button type="button" variant="outline" asChild>
                <a href="/applicants">クリア</a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {canEdit && (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">新規応募者登録</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={createApplicant}
            aria-label="新規応募者登録フォーム"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="last_name">姓</Label>
                <Input id="last_name" name="last_name" required className="w-32" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="first_name">名</Label>
                <Input id="first_name" name="first_name" required className="w-32" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">メールアドレス</Label>
                <Input id="email" name="email" type="email" required className="w-56" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="school_id">学校</Label>
                <select
                  id="school_id"
                  name="school_id"
                  className="h-9 w-44 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">(未設定)</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="graduation_year">卒業予定年</Label>
                <Input
                  id="graduation_year"
                  name="graduation_year"
                  type="number"
                  placeholder="例: 2027"
                  className="w-28"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="applicant_type">応募者区分</Label>
                <select
                  id="applicant_type"
                  name="applicant_type"
                  className="h-9 w-28 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {Object.entries(APPLICANT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hire_type">新卒/中途</Label>
                <select
                  id="hire_type"
                  name="hire_type"
                  className="h-9 w-24 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {Object.entries(HIRE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="position_type">職種区分</Label>
                <select
                  id="position_type"
                  name="position_type"
                  className="h-9 w-28 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">(未設定)</option>
                  {Object.entries(POSITION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>タグ</Label>
                <div className="flex flex-wrap gap-3">
                  {tags.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" name="tag_ids" value={tag.id} />
                      {tag.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Button type="submit">登録</Button>
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
                <TableHead>氏名</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>学校</TableHead>
                <TableHead>区分</TableHead>
                <TableHead>現在のステージ</TableHead>
                <TableHead>タグ</TableHead>
                <TableHead>LINE連携</TableHead>
                {canEdit && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 8 : 7} className="text-center text-muted-foreground">
                    応募者がまだ登録されていません
                  </TableCell>
                </TableRow>
              )}
              {applicants.map((applicant) => (
                <TableRow key={applicant.id}>
                  <TableCell>
                    {applicant.last_name} {applicant.first_name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {applicant.email}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {applicant.school?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">
                        {HIRE_TYPE_LABELS[applicant.hire_type]}
                      </Badge>
                      <Badge variant="outline">
                        {APPLICANT_TYPE_LABELS[applicant.applicant_type]}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {applicant.selection?.current_stage.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {applicant.tags.map(({ tag }) => (
                        <Badge key={tag.id} style={{ backgroundColor: tag.color, color: "#fff" }}>
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {applicant.line_user_id ? (
                      <Badge variant="secondary">連携済み</Badge>
                    ) : (() => {
                        const latestToken = applicant.line_tokens[0];
                        const isActive =
                          latestToken && !latestToken.used_at && latestToken.expires_at > new Date();
                        if (isActive) {
                          const url = `${origin}/line/register?token=${latestToken.token}`;
                          return (
                            <code
                              title={url}
                              className="block max-w-[180px] truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {url}
                            </code>
                          );
                        }
                        if (!canEdit) return <span className="text-muted-foreground">未連携</span>;
                        return (
                          <form action={issueLineRegistrationToken.bind(null, applicant.id)}>
                            <Button type="submit" variant="outline" size="sm">
                              登録リンクを発行
                            </Button>
                          </form>
                        );
                      })()}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <DeleteButton
                        id={applicant.id}
                        action={deleteApplicant}
                        confirmText="この応募者を削除しますか?"
                      />
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
