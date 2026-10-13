"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ViewToggle({
  listView,
  kanbanView,
}: {
  listView: ReactNode;
  kanbanView: ReactNode;
}) {
  const [view, setView] = useState<"list" | "kanban">("kanban");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        <Button
          type="button"
          variant={view === "kanban" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("kanban")}
        >
          カンバン
        </Button>
        <Button
          type="button"
          variant={view === "list" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("list")}
        >
          リスト
        </Button>
      </div>
      {view === "kanban" ? kanbanView : listView}
    </div>
  );
}
