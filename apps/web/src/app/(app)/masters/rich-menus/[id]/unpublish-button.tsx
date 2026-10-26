"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { unpublishRichMenu } from "../actions";

export function UnpublishButton({ richMenuId }: { richMenuId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm("公開を取り下げますか?LINE側のリッチメニューも削除されます。")) return;
    setError(null);
    startTransition(async () => {
      const result = await unpublishRichMenu(richMenuId);
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
        取り下げる
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
