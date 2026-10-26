"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRichMenuPriority } from "../actions";

export function PrioritySelect({ richMenuId, value }: { richMenuId: string; value: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="number"
      aria-label="優先順位を変更"
      disabled={isPending}
      defaultValue={value}
      onBlur={(e) => {
        const next = Number(e.target.value);
        if (Number.isInteger(next) && next !== value) {
          startTransition(async () => {
            await updateRichMenuPriority(richMenuId, next);
            router.refresh();
          });
        }
      }}
      className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-xs disabled:opacity-50"
    />
  );
}
