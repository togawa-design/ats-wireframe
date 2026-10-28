import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentStaff } from "@/lib/auth";
import { canSendLine } from "@/lib/permissions";
import { CreateSurveyForm } from "./create-form";

export default async function SurveysPage() {
  const staff = await getCurrentStaff();
  const canEdit = staff ? canSendLine(staff) : false;

  const surveys = await prisma.survey.findMany({
    include: { _count: { select: { recipients: true, responses: true } } },
    orderBy: { created_at: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">アンケート(FR036)</h1>
        <p className="text-sm text-muted-foreground">
          LIFF経由で応募者にアンケートを送付・回収します。未回答者にはリマインドを再送できます。
        </p>
      </div>

      {canEdit && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">新規作成</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateSurveyForm />
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>タイトル</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>質問数</TableHead>
                <TableHead>送信数</TableHead>
                <TableHead>回答数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    アンケートがまだ登録されていません
                  </TableCell>
                </TableRow>
              )}
              {surveys.map((survey) => (
                <TableRow key={survey.id}>
                  <TableCell>
                    <Link href={`/masters/surveys/${survey.id}`} className="hover:underline">
                      {survey.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={survey.status === "published" ? "default" : "outline"}>
                      {survey.status === "published" ? "公開中" : "下書き"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {Array.isArray(survey.questions) ? survey.questions.length : 0}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {survey._count.recipients}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {survey._count.responses}
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
