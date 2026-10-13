function escapeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** headers は { key: データ取得キー, label: CSV列見出し } の配列。 */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  headers: { key: keyof T; label: string }[]
): string {
  const headerLine = headers.map((h) => escapeCsvValue(h.label)).join(",");
  const lines = rows.map((row) => headers.map((h) => escapeCsvValue(row[h.key])).join(","));
  // Excelでの文字化け対策でBOMを付与する。
  return "﻿" + [headerLine, ...lines].join("\r\n");
}
