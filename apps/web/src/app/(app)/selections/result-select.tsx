"use client";

import { useTransition } from "react";
import { setResult } from "./actions";
import { RESULT_LABELS } from "./result-labels";
import type { SelectionResult } from "@/generated/prisma/client";

export function ResultSelect({
  selectionId,
  value,
}: {
  selectionId: string;
  value: SelectionResult;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      disabled={isPending}
      defaultValue={value}
      onChange={(e) =>
        startTransition(() => setResult(selectionId, e.target.value as SelectionResult))
      }
      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
    >
      {Object.entries(RESULT_LABELS).map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  );
}
