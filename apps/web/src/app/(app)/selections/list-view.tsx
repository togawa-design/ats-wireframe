"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdvanceButton } from "./advance-button";
import { ResultSelect } from "./result-select";
import { RESULT_LABELS } from "./result-labels";
import { bulkSetResult } from "./actions";
import type { SelectionResult } from "@/generated/prisma/client";

export type SelectionRow = {
  id: string;
  applicantName: string;
  stageName: string;
  result: SelectionResult;
  assigneeName: string | null;
  isLastStage: boolean;
};

/** FR097: 選考結果の一括登録に対応したリスト表示。 */
export function SelectionsListView({
  selections,
  canEdit,
}: {
  selections: SelectionRow[];
  canEdit: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResult, setBulkResult] = useState<SelectionResult>("passed");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) =>
      prev.size === selections.length ? new Set() : new Set(selections.map((s) => s.id))
    );
  }

  function applyBulk() {
    setError(null);
    startTransition(async () => {
      try {
        await bulkSetResult(Array.from(selectedIds), bulkResult);
        setSelectedIds(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "一括変更に失敗しました");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <Card className="border-border">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size}件選択中(FR097)
            </span>
            <select
              aria-label="一括変更後の結果"
              value={bulkResult}
              onChange={(e) => setBulkResult(e.target.value as SelectionResult)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {Object.entries(RESULT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              disabled={selectedIds.size === 0 || isPending}
              onClick={applyBulk}
            >
              選択した応募者に一括適用
            </Button>
            {error && <span className="text-xs text-destructive">{error}</span>}
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {canEdit && (
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="すべて選択"
                      checked={selections.length > 0 && selectedIds.size === selections.length}
                      onChange={toggleAll}
                    />
                  </TableHead>
                )}
                <TableHead>応募者</TableHead>
                <TableHead>現在のステージ</TableHead>
                <TableHead>結果</TableHead>
                <TableHead>担当者</TableHead>
                {canEdit && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {selections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 6 : 4} className="text-center text-muted-foreground">
                    選考中の応募者がいません
                  </TableCell>
                </TableRow>
              )}
              {selections.map((selection) => (
                <TableRow key={selection.id}>
                  {canEdit && (
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`${selection.applicantName}を選択`}
                        checked={selectedIds.has(selection.id)}
                        onChange={() => toggle(selection.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>{selection.applicantName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{selection.stageName}</Badge>
                  </TableCell>
                  <TableCell>
                    {/* ResultSelectは非制御コンポーネントのため、一括登録(FR097)など
                        ユーザー操作以外でresultが変わった際にも表示を追従させるため、
                        resultをkeyに含めて値が変わるたびに再マウントする。 */}
                    {canEdit ? (
                      <ResultSelect
                        key={selection.result}
                        selectionId={selection.id}
                        value={selection.result}
                      />
                    ) : (
                      <Badge variant="outline">{RESULT_LABELS[selection.result]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {selection.assigneeName ?? "—"}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      {!selection.isLastStage && <AdvanceButton selectionId={selection.id} />}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
