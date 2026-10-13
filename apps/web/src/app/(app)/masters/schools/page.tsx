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
import { createSchool, deleteSchool } from "./actions";
import { DeleteButton } from "@/components/delete-button";
import { getCurrentStaff } from "@/lib/auth";
import { canManage } from "@/lib/permissions";

const SCHOOL_TYPE_LABELS: Record<string, string> = {
  university: "大学",
  graduate_school: "大学院",
  junior_college: "短大",
  vocational_school: "専門",
  kosen: "高専",
};

export default async function SchoolsPage() {
  const staff = await getCurrentStaff();
  const canEdit = staff ? canManage(staff) : false;

  const schools = await prisma.school.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">学校マスター</h1>
        <p className="text-sm text-muted-foreground">
          応募者の出身校を管理します。学校カテゴリは学校別分析の軸として使用されます。
        </p>
      </div>

      {canEdit && (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">新規学校追加</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSchool} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">学校名</Label>
              <Input id="name" name="name" placeholder="例: 〇〇大学" required className="w-56" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">種別</Label>
              <select
                id="type"
                name="type"
                required
                className="h-9 w-32 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {Object.entries(SCHOOL_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">カテゴリ</Label>
              <Input
                id="category"
                name="category"
                placeholder="例: 旧帝大, MARCH"
                className="w-40"
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
                <TableHead>学校名</TableHead>
                <TableHead>種別</TableHead>
                <TableHead>カテゴリ</TableHead>
                {canEdit && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 4 : 3} className="text-center text-muted-foreground">
                    学校がまだ登録されていません
                  </TableCell>
                </TableRow>
              )}
              {schools.map((school) => (
                <TableRow key={school.id}>
                  <TableCell>{school.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {SCHOOL_TYPE_LABELS[school.type] ?? school.type}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {school.category ?? "—"}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <DeleteButton id={school.id} action={deleteSchool} confirmText="この学校を削除しますか?" />
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
