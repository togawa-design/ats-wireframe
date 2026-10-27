"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRichMenu } from "./actions";
import {
  RICH_MENU_LAYOUTS,
  RICH_MENU_LAYOUT_KEYS,
  type RichMenuLayoutKey,
} from "@/lib/line/rich-menu-layouts";

/** FR034: リッチメニューの下書きを作成するフォーム(レイアウトに応じてエリア数が変わる)。 */
export function CreateRichMenuForm() {
  const router = useRouter();
  const [layout, setLayout] = useState<RichMenuLayoutKey>("one");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createRichMenu(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      (document.getElementById("rich-menu-create-form") as HTMLFormElement | null)?.reset();
      setLayout("one");
    });
  }

  const areaCount = RICH_MENU_LAYOUTS[layout].bounds.length;

  return (
    <form id="rich-menu-create-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">名前</Label>
          <Input id="name" name="name" required className="w-56" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chat_bar_text">チャットバーのテキスト(14文字以内)</Label>
          <Input id="chat_bar_text" name="chat_bar_text" maxLength={14} required className="w-56" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="layout">レイアウト</Label>
          <select
            id="layout"
            name="layout"
            value={layout}
            onChange={(e) => setLayout(e.target.value as RichMenuLayoutKey)}
            className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {RICH_MENU_LAYOUT_KEYS.map((key) => (
              <option key={key} value={key}>
                {RICH_MENU_LAYOUTS[key].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: areaCount }).map((_, i) => (
          <div key={i} className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
            <span className="text-xs font-medium text-muted-foreground">エリア{i + 1}</span>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`area_label_${i}`}>ラベル(管理用)</Label>
              <Input id={`area_label_${i}`} name={`area_label_${i}`} className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`area_action_type_${i}`}>アクション種別</Label>
              <select
                id={`area_action_type_${i}`}
                name={`area_action_type_${i}`}
                defaultValue="uri"
                className="h-9 w-32 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="uri">URLを開く</option>
                <option value="message">メッセージ送信</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`area_uri_${i}`}>遷移先URL(URLを開くを選んだ場合)</Label>
              <Input id={`area_uri_${i}`} name={`area_uri_${i}`} placeholder="https://" className="w-64" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`area_text_${i}`}>送信メッセージ(メッセージ送信を選んだ場合)</Label>
              <Input id={`area_text_${i}`} name={`area_text_${i}`} className="w-64" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          下書きとして作成
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </form>
  );
}
