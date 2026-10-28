"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { publishSurvey } from "../actions";

export function PublishButton({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await publishSurvey(surveyId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" disabled={isPending} onClick={handleClick}>
        公開する
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
