import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { canManage } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/delete-button";
import {
  RICH_MENU_LAYOUTS,
  type RichMenuLayoutKey,
} from "@/lib/line/rich-menu-layouts";
import type { RichMenuAreaAction } from "@/lib/line/client";
import { deleteRichMenuRecord, removeRichMenuRule } from "../actions";
import { PublishForm } from "./publish-form";
import { UnpublishButton } from "./unpublish-button";
import { PrioritySelect } from "./priority-select";
import { AddRuleForm } from "./add-rule-form";

export default async function RichMenuDetailPage({
  params,
}: PageProps<"/masters/rich-menus/[id]">) {
  const { id } = await params;

  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  const canEdit = canManage(staff);

  const [richMenu, tags] = await Promise.all([
    prisma.richMenu.findUnique({
      where: { id },
      include: { rules: { include: { tag: true } } },
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!richMenu) notFound();

  const layout = RICH_MENU_LAYOUTS[richMenu.layout as RichMenuLayoutKey] as
    | (typeof RICH_MENU_LAYOUTS)[RichMenuLayoutKey]
    | undefined;
  const areas = richMenu.areas as unknown as RichMenuAreaAction[];
  const assignedTagIds = new Set(richMenu.rules.map((r) => r.tag_id));
  const unassignedTags = tags.filter((t) => !assignedTagIds.has(t.id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/masters/rich-menus" className="text-sm text-muted-foreground hover:underline">
          ← リッチメニュー一覧に戻る
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">{richMenu.name}</h1>
          <Badge variant={richMenu.status === "published" ? "default" : "outline"}>
            {richMenu.status === "published" ? "公開中" : "下書き"}
          </Badge>
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <InfoRow label="チャットバー" value={richMenu.chat_bar_text} />
          <InfoRow label="レイアウト" value={layout?.label ?? richMenu.layout} />
          <InfoRow
            label="優先順位"
            value={
              canEdit ? (
                <PrioritySelect richMenuId={richMenu.id} value={richMenu.priority} />
              ) : (
                richMenu.priority
              )
            }
          />
          {richMenu.image_url && (
            <InfoRow
              label="画像"
              value={
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={richMenu.image_url}
                  alt={richMenu.name}
                  className="max-w-md rounded-md border border-border"
                />
              }
            />
          )}
          <InfoRow
            label="エリア"
            value={
              <ul className="flex flex-col gap-1">
                {areas.map((area, i) => (
                  <li key={i}>
                    {area.label}:{" "}
                    {area.actionType === "uri" ? `URLを開く(${area.uri})` : `メッセージ送信「${area.text}」`}
                  </li>
                ))}
              </ul>
            }
          />
        </CardContent>
      </Card>

      {canEdit && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">公開操作</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {richMenu.status === "draft" ? (
              <PublishForm richMenuId={richMenu.id} />
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  公開中のため編集できません。変更する場合は一旦取り下げてください。
                </p>
                <UnpublishButton richMenuId={richMenu.id} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">タグ連動の自動切替ルール(FR035)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            ここにタグを登録すると、そのタグを持つ応募者のLINEリッチメニューが自動でこのメニューに切り替わります(公開中の場合のみ)。
            タグが1件も登録されていないメニューは、ルールに一致しない全員向けの既定メニューとして扱われます。
          </p>
          {richMenu.rules.length === 0 && (
            <p className="text-sm text-muted-foreground">タグルールはまだありません(既定メニュー扱い)</p>
          )}
          {richMenu.rules.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {richMenu.rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-2.5 pr-1"
                >
                  <Badge style={{ backgroundColor: rule.tag.color, color: "#fff" }}>
                    {rule.tag.name}
                  </Badge>
                  {canEdit && (
                    <DeleteButton
                      id={rule.id}
                      action={removeRichMenuRule.bind(null, richMenu.id)}
                      confirmText="このルールを削除しますか?"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {canEdit && unassignedTags.length > 0 && (
            <AddRuleForm richMenuId={richMenu.id} tags={unassignedTags} />
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <div>
          <DeleteButton
            id={richMenu.id}
            action={deleteRichMenuRecord}
            confirmText="このリッチメニューを削除しますか?(公開中の場合はLINE側からも削除されます)"
          />
        </div>
      )}
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
