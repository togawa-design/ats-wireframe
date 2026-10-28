"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { sendSurvey, type SurveySendResult } from "../actions";

type Tag = { id: string; name: string };

export function SendForm({ surveyId, tags }: { surveyId: string; tags: Tag[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SurveySendResult | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await sendSurvey(surveyId, formData);
      setResult(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tag_id">送信対象(タグで絞り込み)</Label>
          <select
            id="tag_id"
            name="tag_id"
            className="h-9 w-48 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">全員(新卒・LINE連携済み・未送信)</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "送信中..." : "送信する"}
        </Button>
      </div>
      {result && !result.ok && <p className="text-xs text-destructive">{result.error}</p>}
      {result && result.ok && (
        <p className="text-xs text-muted-foreground">
          {result.total}件中、{result.successCount}件送信しました
          {result.failureCount > 0 && `(失敗: ${result.failureCount}件)`}。
        </p>
      )}
    </form>
  );
}
