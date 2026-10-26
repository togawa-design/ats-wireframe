"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RICH_MENU_IMAGE_SIZE } from "@/lib/line/rich-menu-layouts";
import { publishRichMenu } from "../actions";

/** FR034: 画像をアップロードしてLINEへ公開するフォーム。 */
export function PublishForm({ richMenuId }: { richMenuId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await publishRichMenu(richMenuId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="image"
          accept="image/png,image/jpeg"
          required
          className="text-xs"
        />
        <Button type="submit" disabled={isPending} size="sm">
          公開する
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        画像サイズは{RICH_MENU_IMAGE_SIZE.width}x{RICH_MENU_IMAGE_SIZE.height}px(PNG/JPEG)にしてください。
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
