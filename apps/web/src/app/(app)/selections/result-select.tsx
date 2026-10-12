"use client";

import { useTransition } from "react";
import { setResult } from "./actions";
import type { SelectionResult } from "@/generated/prisma/client";

const RESULT_LABELS: Record<SelectionResult, string> = {
  pending: "選考中",
  passed: "通過",
  failed: "不合格",
  withdrawn: "辞退",
  offer_declined: "内定辞退",
};

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
