"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateColumnPreference } from "./column-actions";
import { APPLICANT_COLUMNS, type ApplicantColumnKey } from "./columns";

const LABEL_BY_KEY = new Map(APPLICANT_COLUMNS.map((c) => [c.key, c.label]));

type Row = { key: ApplicantColumnKey; label: string; visible: boolean };

function buildInitialRows(order: ApplicantColumnKey[]): Row[] {
  const visibleSet = new Set(order);
  const hidden = APPLICANT_COLUMNS.map((c) => c.key).filter((key) => !visibleSet.has(key));
  return [...order, ...hidden].map((key) => ({
    key,
    label: LABEL_BY_KEY.get(key) ?? key,
    visible: visibleSet.has(key),
  }));
}

/** FR099: 応募者一覧の表示列の表示/非表示・並び順を設定する。 */
export function ColumnSettingsForm({ initialOrder }: { initialOrder: ApplicantColumnKey[] }) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => buildInitialRows(initialOrder));
  const [saved, setSaved] = useState(false);

  function move(index: number, dir: -1 | 1) {
    setSaved(false);
    setRows((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggle(index: number) {
    setSaved(false);
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, visible: !row.visible } : row)));
  }

  function handleSave() {
    const columns = rows.filter((r) => r.visible).map((r) => r.key);
    startTransition(async () => {
      await updateColumnPreference(columns);
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {rows.map((row, index) => (
          // 列ラベル(「メールアドレス」等)はアプリ内で広く再利用されている文言のため、
          // aria-labelにそのまま含めるとe2eのgetByLabel(部分一致)が他画面要素と
          // 衝突する。data-testidで一意に識別する。
          <li
            key={row.key}
            data-testid={`column-row-${row.key}`}
            className="flex items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              checked={row.visible}
              onChange={() => toggle(index)}
              data-testid={`column-toggle-${row.key}`}
            />
            <span className="w-36 shrink-0">{row.label}</span>
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              data-testid={`column-up-${row.key}`}
              aria-label="上へ移動"
              className="text-muted-foreground disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === rows.length - 1}
              data-testid={`column-down-${row.key}`}
              aria-label="下へ移動"
              className="text-muted-foreground disabled:opacity-30"
            >
              ↓
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleSave}>
          保存
        </Button>
        {saved && <span className="text-xs text-muted-foreground">保存しました</span>}
      </div>
    </div>
  );
}
