"use server";

import { parse } from "csv-parse/sync";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { createDefaultSelection } from "@/lib/selection";
import { detectMapping, type ImportFieldKey } from "@/lib/field-mapping";

function parseCsv(csvText: string): Record<string, string>[] {
  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }) as Record<string, string>[];
}

export type CsvPreview = {
  headers: string[];
  previewRows: Record<string, string>[];
  mapping: Partial<Record<ImportFieldKey, string>>;
  csvText: string;
  rowCount: number;
};

/** CSVファイルをアップロードし、ヘッダー検出・自動マッピングを行う(登録はまだ実行しない)。 */
export async function previewImport(mediaId: string, formData: FormData): Promise<CsvPreview> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("CSVファイルを選択してください");
  const csvText = await file.text();

  const rows = parseCsv(csvText);
  if (rows.length === 0) throw new Error("CSVにデータ行がありません");
  const headers = Object.keys(rows[0]);

  const media = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } });
  const savedMapping = (media.field_mapping ?? {}) as Partial<Record<ImportFieldKey, string>>;
  const validSavedMapping = Object.fromEntries(
    Object.entries(savedMapping).filter(([, header]) => headers.includes(header as string))
  ) as Partial<Record<ImportFieldKey, string>>;

  // 保存済みマッピングを優先し、未設定の項目のみ自動検出結果で補完する(「自動マッピング」対応)。
  const mapping = { ...detectMapping(headers), ...validSavedMapping };

  return { headers, previewRows: rows.slice(0, 5), mapping, csvText, rowCount: rows.length };
}

export type ImportResult = { created: number; skipped: number; total: number };

/** マッピング確定後、CSVの内容から応募者を一括登録する。 */
export async function importApplicants(
  mediaId: string,
  csvText: string,
  mapping: Partial<Record<ImportFieldKey, string>>
): Promise<ImportResult> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  if (!mapping.last_name || !mapping.first_name || !mapping.email) {
    throw new Error("姓・名・メールアドレスのマッピングは必須です");
  }

  const rows = parseCsv(csvText);
  const schools = await prisma.school.findMany();
  const schoolIdByName = new Map(schools.map((s) => [s.name, s.id]));

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const email = mapping.email ? row[mapping.email]?.trim() : "";
    const last_name = mapping.last_name ? row[mapping.last_name]?.trim() : "";
    const first_name = mapping.first_name ? row[mapping.first_name]?.trim() : "";
    if (!email || !last_name || !first_name) {
      skipped++;
      continue;
    }

    const existing = await prisma.applicant.findFirst({ where: { email } });
    if (existing) {
      skipped++;
      continue;
    }

    const schoolName = mapping.school_name ? row[mapping.school_name]?.trim() : "";
    const graduationYearRaw = mapping.graduation_year ? row[mapping.graduation_year]?.trim() : "";

    const applicant = await prisma.applicant.create({
      data: {
        last_name,
        first_name,
        last_name_kana: (mapping.last_name_kana && row[mapping.last_name_kana]?.trim()) || null,
        first_name_kana: (mapping.first_name_kana && row[mapping.first_name_kana]?.trim()) || null,
        email,
        phone: (mapping.phone && row[mapping.phone]?.trim()) || null,
        department: (mapping.department && row[mapping.department]?.trim()) || null,
        graduation_year: graduationYearRaw ? Number(graduationYearRaw) || null : null,
        school_id: (schoolName && schoolIdByName.get(schoolName)) || null,
      },
    });

    await prisma.applicantSource.create({
      data: {
        applicant_id: applicant.id,
        media_id: mediaId,
        external_applicant_id:
          (mapping.external_applicant_id && row[mapping.external_applicant_id]?.trim()) || null,
        raw_data: row,
      },
    });

    await createDefaultSelection(applicant.id);
    created++;
  }

  // 次回以降の自動マッピングのために、確定したマッピングを媒体マスターへ保存する。
  await prisma.media.update({ where: { id: mediaId }, data: { field_mapping: mapping } });

  revalidatePath("/applicants");
  revalidatePath("/masters/media");

  return { created, skipped, total: rows.length };
}
