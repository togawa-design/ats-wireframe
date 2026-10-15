"use client";

import { useTransition } from "react";
import { updateApplicantCallStatus } from "./call-log-actions";
import type { CallStatus } from "@/generated/prisma/client";

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  none: "—",
  callback_needed: "要架電",
  no_answer: "不在",
};

export function CallStatusSelect({
  applicantId,
  value,
}: {
  applicantId: string;
  value: CallStatus;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      aria-label="架電状況を変更"
      disabled={isPending}
      defaultValue={value}
      onChange={(e) =>
        startTransition(() => updateApplicantCallStatus(applicantId, e.target.value as CallStatus))
      }
      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs disabled:opacity-50"
    >
      {Object.entries(CALL_STATUS_LABELS).map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  );
}
