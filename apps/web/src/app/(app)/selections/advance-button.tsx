"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { advanceStage } from "./actions";

export function AdvanceButton({ selectionId }: { selectionId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => advanceStage(selectionId))}
    >
      次のステージへ
    </Button>
  );
}
