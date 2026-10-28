"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { remindSurvey, type SurveySendResult } from "../actions";

export function RemindButton({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SurveySendResult | null>(null);

  function handleClick() {
    startTransition(async () => {
      const res = await remindSurvey(surveyId);
      setResult(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleClick}>
        {isPending ? "送信中..." : "未回答者にリマインドを送る"}
      </Button>
      {result && !result.ok && <span className="text-xs text-destructive">{result.error}</span>}
      {result && result.ok && (
        <span className="text-xs text-muted-foreground">
          {result.total}件中、{result.successCount}件送信しました
          {result.failureCount > 0 && `(失敗: ${result.failureCount}件)`}。
        </span>
      )}
    </div>
  );
}
