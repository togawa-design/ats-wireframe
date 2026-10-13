/**
 * FR040: 媒体CSV取込の項目マッピング定義。
 * 媒体ごとにCSVの列名はバラバラなため、取込対象の論理項目(key)と
 * よくある列名(aliases)の対応表から自動マッピングを試みる。
 */
export type ImportFieldKey =
  | "last_name"
  | "first_name"
  | "last_name_kana"
  | "first_name_kana"
  | "email"
  | "phone"
  | "school_name"
  | "department"
  | "graduation_year"
  | "external_applicant_id";

export type ImportFieldDef = {
  key: ImportFieldKey;
  label: string;
  required: boolean;
  aliases: string[];
};

export const IMPORT_FIELDS: ImportFieldDef[] = [
  { key: "last_name", label: "姓", required: true, aliases: ["姓", "苗字", "lastname", "last_name", "名前(姓)"] },
  { key: "first_name", label: "名", required: true, aliases: ["名", "firstname", "first_name", "名前(名)"] },
  { key: "last_name_kana", label: "姓(カナ)", required: false, aliases: ["姓カナ", "姓(カナ)", "セイ", "lastnamekana"] },
  { key: "first_name_kana", label: "名(カナ)", required: false, aliases: ["名カナ", "名(カナ)", "メイ", "firstnamekana"] },
  { key: "email", label: "メールアドレス", required: true, aliases: ["email", "mail", "メールアドレス", "メール"] },
  { key: "phone", label: "電話番号", required: false, aliases: ["phone", "tel", "電話番号", "電話"] },
  { key: "school_name", label: "学校名", required: false, aliases: ["school", "学校名", "学校", "大学名"] },
  { key: "department", label: "学部・学科", required: false, aliases: ["department", "学部", "学科", "学部学科"] },
  { key: "graduation_year", label: "卒業予定年", required: false, aliases: ["graduationyear", "卒業年", "卒業予定年"] },
  { key: "external_applicant_id", label: "媒体側ID", required: false, aliases: ["id", "応募者id", "管理番号", "externalid"] },
];

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_()（）・-]/g, "");
}

/** CSVヘッダー行から、論理項目key → CSV列名 のマッピングを自動検出する。 */
export function detectMapping(headers: string[]): Partial<Record<ImportFieldKey, string>> {
  const usedHeaders = new Set<string>();
  const mapping: Partial<Record<ImportFieldKey, string>> = {};

  for (const field of IMPORT_FIELDS) {
    const normalizedAliases = field.aliases.map(normalizeHeader);
    const match = headers.find(
      (header) => !usedHeaders.has(header) && normalizedAliases.includes(normalizeHeader(header))
    );
    if (match) {
      mapping[field.key] = match;
      usedHeaders.add(match);
    }
  }

  return mapping;
}
