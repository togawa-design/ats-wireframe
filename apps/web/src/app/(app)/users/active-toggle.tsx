"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleStaffActive } from "./actions";

export function ActiveToggle({
  staffId,
  isActive,
  disabled,
}: {
  staffId: string;
  isActive: boolean;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || isPending}
      className={isActive ? "text-destructive hover:text-destructive" : ""}
      onClick={() => {
        if (isActive && !confirm("このアカウントを停止しますか?")) return;
        startTransition(() => toggleStaffActive(staffId, !isActive));
      }}
    >
      {isActive ? "停止する" : "再開する"}
    </Button>
  );
}
