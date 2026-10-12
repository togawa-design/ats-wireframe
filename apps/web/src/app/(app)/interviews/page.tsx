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
import { createInterview, deleteInterview } from "./actions";
import { DeleteButton } from "@/components/delete-button";

export default async function InterviewsPage() {
  const [interviews, selections, staffList] = await Promise.all([
    prisma.interview.findMany({
      include: { selection: { include: { applicant: true } }, stage: true, interviewer: true },
      orderBy: { scheduled_at: "desc" },
    }),
    prisma.selection.findMany({
      include: { applicant: true },
      orderBy: { applicant: { created_at: "desc" } },
    }),
    prisma.staff.findMany({ where: { is_active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">面接</h1>
        <p className="text-sm text-muted-foreground">
          面接の実施記録を管理します。評価は現時点では簡易サマリー(点数・メモ)のみです。
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">面接記録を登録</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createInterview} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="selection_id">応募者</Label>
              <select
                id="selection_id"
                name="selection_id"
                required
                className="h-9 w-48 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">選択してください</option>
                {selections.map((selection) => (
                  <option key={selection.id} value={selection.id}>
                    {selection.applicant.last_name} {selection.applicant.first_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="interviewer_id">面接官</Label>
              <select
                id="interviewer_id"
                name="interviewer_id"
                required
                className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">選択してください</option>
                {staffList.map((staffMember) => (
                  <option key={staffMember.id} value={staffMember.id}>
                    {staffMember.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduled_at">面接日時</Label>
              <Input
                id="scheduled_at"
                name="scheduled_at"
                type="datetime-local"
                required
                className="w-56"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="score">評価(1〜5)</Label>
              <Input
                id="score"
                name="score"
                type="number"
                min={1}
                max={5}
                placeholder="任意"
                className="w-24"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">メモ</Label>
              <Input id="notes" name="notes" placeholder="任意" className="w-56" />
            </div>
            <Button type="submit">登録</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>応募者</TableHead>
                <TableHead>ステージ</TableHead>
                <TableHead>面接官</TableHead>
                <TableHead>面接日時</TableHead>
                <TableHead>評価</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    面接記録がまだありません
                  </TableCell>
                </TableRow>
              )}
              {interviews.map((interview) => (
                <TableRow key={interview.id}>
                  <TableCell>
                    {interview.selection.applicant.last_name}{" "}
                    {interview.selection.applicant.first_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{interview.stage.name}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {interview.interviewer.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {interview.scheduled_at.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {interview.score ? `${interview.score}/5` : "—"}
                    {interview.notes && (
                      <span className="ml-1 text-xs text-muted-foreground/70">
                        ({interview.notes})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteButton
                      id={interview.id}
                      action={deleteInterview}
                      confirmText="この面接記録を削除しますか?"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
