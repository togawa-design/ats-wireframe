"use client";

import { useTransition } from "react";
import { updateStaffRole } from "./actions";
import { ROLE_LABELS } from "./role-labels";
import type { StaffRole } from "@/generated/prisma/client";

export function RoleSelect({
  staffId,
  value,
  disabled,
}: {
  staffId: string;
  value: StaffRole;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      disabled={disabled || isPending}
      defaultValue={value}
      onChange={(e) => startTransition(() => updateStaffRole(staffId, e.target.value as StaffRole))}
      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs disabled:opacity-50"
    >
      {Object.entries(ROLE_LABELS).map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  );
}
