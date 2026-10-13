"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renameStage, changeStageType, moveStage, deleteStage } from "./actions";
import { STAGE_TYPE_LABELS } from "./stage-labels";
import type { StageType } from "@/generated/prisma/client";

export function StageRow({
  stage,
  isFirst,
  isLast,
}: {
  stage: { id: string; name: string; order: number; stage_type: StageType };
  isFirst: boolean;
  isLast: boolean;
}) {
  const [name, setName] = useState(stage.name);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
      <span className="w-6 text-sm text-muted-foreground">{stage.order}.</span>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== stage.name) {
            startTransition(() => renameStage(stage.id, name));
          }
        }}
        className="h-8 w-40 text-sm"
        disabled={isPending}
      />
      <select
        defaultValue={stage.stage_type}
        disabled={isPending}
        onChange={(e) => startTransition(() => changeStageType(stage.id, e.target.value as StageType))}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
      >
        {Object.entries(STAGE_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={isPending || isFirst}
          onClick={() => startTransition(() => moveStage(stage.id, "up"))}
        >
          ↑
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending || isLast}
          onClick={() => startTransition(() => moveStage(stage.id, "down"))}
        >
          ↓
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          className="text-destructive hover:text-destructive"
          onClick={() => {
            if (!confirm(`「${stage.name}」ステージを削除しますか?`)) return;
            startTransition(() => deleteStage(stage.id));
          }}
        >
          削除
        </Button>
      </div>
    </div>
  );
}
