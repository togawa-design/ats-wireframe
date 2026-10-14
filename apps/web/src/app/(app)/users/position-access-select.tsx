"use client";

import { useTransition } from "react";
import { updateStaffPositionAccess } from "./actions";
import { POSITION_ACCESS_LABELS } from "./position-access-labels";
import type { StaffPositionAccess } from "@/generated/prisma/client";

export function PositionAccessSelect({
  staffId,
  value,
  disabled,
}: {
  staffId: string;
  value: StaffPositionAccess;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      aria-label="職種区分を変更"
      disabled={disabled || isPending}
      defaultValue={value}
      onChange={(e) =>
        startTransition(() =>
          updateStaffPositionAccess(staffId, e.target.value as StaffPositionAccess)
        )
      }
      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs disabled:opacity-50"
    >
      {Object.entries(POSITION_ACCESS_LABELS).map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  );
}
