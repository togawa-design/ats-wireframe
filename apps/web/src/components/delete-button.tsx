"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function DeleteButton({
  id,
  action,
  confirmText = "削除しますか?",
}: {
  id: string;
  action: (id: string) => Promise<void>;
  confirmText?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      className="text-destructive hover:text-destructive"
      onClick={() => {
        if (!confirm(confirmText)) return;
        startTransition(() => action(id));
      }}
    >
      削除
    </Button>
  );
}
