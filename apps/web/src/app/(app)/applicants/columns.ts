/** FR099: 応募者一覧でカスタマイズ可能な表示列(氏名・操作列は常に固定表示のため対象外)。 */
export type ApplicantColumnKey =
  | "email"
  | "school"
  | "type"
  | "stage"
  | "tags"
  | "call_status"
  | "line";

export const APPLICANT_COLUMNS: { key: ApplicantColumnKey; label: string }[] = [
  { key: "email", label: "メールアドレス" },
  { key: "school", label: "学校" },
  { key: "type", label: "区分" },
  { key: "stage", label: "現在のステージ" },
  { key: "tags", label: "タグ" },
  { key: "call_status", label: "架電状況" },
  { key: "line", label: "LINE連携" },
];

export const DEFAULT_APPLICANT_COLUMN_ORDER: ApplicantColumnKey[] = APPLICANT_COLUMNS.map(
  (c) => c.key
);

const KNOWN_COLUMN_KEYS = new Set<string>(DEFAULT_APPLICANT_COLUMN_ORDER);

/**
 * FR099: 保存済みの表示列設定(JSON配列)から、不正・未知・重複したキーを除いた
 * 有効な並び順を取り出す。配列として保存されていない場合(未保存・壊れたデータ)は
 * 既定の並び順にフォールバックする。
 */
export function parseColumnOrder(raw: unknown): ApplicantColumnKey[] {
  if (!Array.isArray(raw)) return DEFAULT_APPLICANT_COLUMN_ORDER;

  const seen = new Set<string>();
  const result: ApplicantColumnKey[] = [];
  for (const item of raw) {
    if (typeof item === "string" && KNOWN_COLUMN_KEYS.has(item) && !seen.has(item)) {
      seen.add(item);
      result.push(item as ApplicantColumnKey);
    }
  }
  return result;
}
