import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendForm } from "./send-form";
import { getCurrentStaff } from "@/lib/auth";
import { canSendLine } from "@/lib/permissions";

export default async function LineSendPage() {
  const staff = await getCurrentStaff();
  if (!staff || !canSendLine(staff)) {
    redirect("/");
  }

  const [tags, recipientCount] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.applicant.count({ where: { hire_type: "new_grad", line_user_id: { not: null } } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">LINEメッセージ送信</h1>
        <p className="text-sm text-muted-foreground">
          タグで絞り込んだ新卒応募者(LINE連携済み)にテキストメッセージを一斉送信します。中途応募者はLINE機能の対象外です。
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">
            現在LINE連携済みの新卒応募者: {recipientCount}名
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SendForm tags={tags} />
        </CardContent>
      </Card>
    </div>
  );
}
