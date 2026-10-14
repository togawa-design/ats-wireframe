import { redirect } from "next/navigation";
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
import { getCurrentStaff } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { inviteStaff } from "./actions";
import { RoleSelect } from "./role-select";
import { ROLE_LABELS } from "./role-labels";
import { PositionAccessSelect } from "./position-access-select";
import { POSITION_ACCESS_LABELS } from "./position-access-labels";
import { ActiveToggle } from "./active-toggle";

export default async function UsersPage() {
  const currentStaff = await getCurrentStaff();
  if (!currentStaff || !isAdmin(currentStaff)) {
    redirect("/");
  }

  const staffList = await prisma.staff.findMany({ orderBy: { created_at: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">ユーザー管理</h1>
        <p className="text-sm text-muted-foreground">
          担当者アカウントのロール変更・停止を行います(FR086/FR087、管理者のみ)。メール送信基盤が無いため、ここで追加した担当者は自分のGoogleアカウントで初回ログインした時点で紐付きます。
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">担当者を追加</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={inviteStaff} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">氏名</Label>
              <Input id="name" name="name" required className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" name="email" type="email" required className="w-64" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">ロール</Label>
              <select
                id="role"
                name="role"
                className="h-9 w-32 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="position_type_access">職種区分(FR095)</Label>
              <select
                id="position_type_access"
                name="position_type_access"
                className="h-9 w-32 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {Object.entries(POSITION_ACCESS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">追加</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>氏名</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>ロール</TableHead>
                <TableHead>職種区分</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList.map((member) => {
                const isSelf = member.id === currentStaff.id;
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      {member.name}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(自分)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <RoleSelect staffId={member.id} value={member.role} disabled={isSelf} />
                    </TableCell>
                    <TableCell>
                      <PositionAccessSelect
                        staffId={member.id}
                        value={member.position_type_access}
                      />
                    </TableCell>
                    <TableCell>
                      {member.is_active ? (
                        <Badge variant="secondary">有効</Badge>
                      ) : (
                        <Badge variant="destructive">停止中</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActiveToggle
                        staffId={member.id}
                        isActive={member.is_active}
                        disabled={isSelf}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
