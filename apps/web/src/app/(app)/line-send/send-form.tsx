"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { sendBulkLineMessage } from "./actions";

type Tag = { id: string; name: string };

const initialState: { successCount: number; failureCount: number; total: number } | null = null;

export function SendForm({ tags }: { tags: Tag[] }) {
  const [result, formAction, isPending] = useActionState(async (_: typeof initialState, formData: FormData) => {
    return sendBulkLineMessage(formData);
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tag_id">送信対象(タグで絞り込み)</Label>
          <select
            id="tag_id"
            name="tag_id"
            className="h-9 w-48 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">全員(新卒・LINE連携済み)</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="text">メッセージ本文</Label>
        <textarea
          id="text"
          name="text"
          required
          rows={4}
          placeholder="{{last_name}} {{first_name}} さん のように差し込み変数が使えます"
          className="w-full max-w-xl rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "送信中..." : "送信"}
        </Button>
      </div>
      {result && (
        <p className="text-sm text-muted-foreground">
          {result.total}件中、{result.successCount}件送信しました
          {result.failureCount > 0 && `(失敗: ${result.failureCount}件)`}。
        </p>
      )}
    </form>
  );
}
