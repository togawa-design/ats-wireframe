"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IMPORT_FIELDS, type ImportFieldKey } from "@/lib/field-mapping";
import { previewImport, importApplicants, type CsvPreview, type ImportResult } from "./actions";

export function ImportForm({ mediaId }: { mediaId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportFieldKey, string>>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const next = await previewImport(mediaId, formData);
        setPreview(next);
        setMapping(next.mapping);
        setResult(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "CSVの読み込みに失敗しました");
      }
    });
  }

  function handleImport() {
    if (!preview) return;
    setError(null);
    startTransition(async () => {
      try {
        const next = await importApplicants(mediaId, preview.csvText, mapping);
        setResult(next);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "取込に失敗しました");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">1. CSVファイルを選択</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={(formData) => handleUpload(formData)}
            className="flex flex-wrap items-end gap-3"
          >
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
            />
            <Button type="submit" disabled={isPending}>
              読み込み
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {preview && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">
              2. 項目マッピングを確認({preview.rowCount}件を検出)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {IMPORT_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-2">
                  <label htmlFor={`mapping-${field.key}`} className="w-32 shrink-0 text-sm text-foreground">
                    {field.label}
                  </label>
                  {field.required && <span aria-hidden className="-ml-1.5 text-destructive">*</span>}
                  <select
                    id={`mapping-${field.key}`}
                    value={mapping[field.key] ?? ""}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [field.key]: e.target.value || undefined }))
                    }
                    className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="">(対応なし)</option>
                    {preview.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {preview.headers.map((header) => (
                      <th key={header} className="px-2 py-1.5 text-left font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {preview.headers.map((header) => (
                        <td key={header} className="px-2 py-1.5 text-muted-foreground">
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <Button onClick={handleImport} disabled={isPending}>
                この内容で取り込む
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <p className="text-sm text-foreground">
          取込完了: {result.total}件中 {result.created}件を新規登録、{result.skipped}件を重複等でスキップしました。
        </p>
      )}
    </div>
  );
}
