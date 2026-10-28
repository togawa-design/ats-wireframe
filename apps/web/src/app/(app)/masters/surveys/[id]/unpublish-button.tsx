"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { unpublishSurvey } from "../actions";

export function UnpublishButton({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm("下書きに戻しますか?")) return;
    setError(null);
    startTransition(async () => {
      const result = await unpublishSurvey(surveyId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleClick}>
        下書きに戻す
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
