import type { ApplicantType, PositionType, Prisma } from "@/generated/prisma/client";

export type ApplicantFilters = {
  q?: string;
  schoolId?: string;
  tagIds: string[];
  stageId?: string;
  mediaId?: string;
  applicantType?: ApplicantType;
  positionType?: PositionType;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function getOne(searchParams: RawSearchParams, key: string): string | undefined {
  const value = searchParams[key];
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function getAll(searchParams: RawSearchParams, key: string): string[] {
  const value = searchParams[key];
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.filter(Boolean);
}

/** FR004: URLクエリパラメータ(searchParams)から応募者一覧の絞り込み条件を取り出す。 */
export function parseApplicantFilters(searchParams: RawSearchParams): ApplicantFilters {
  return {
    q: getOne(searchParams, "q"),
    schoolId: getOne(searchParams, "school_id"),
    tagIds: getAll(searchParams, "tag_ids"),
    stageId: getOne(searchParams, "stage_id"),
    mediaId: getOne(searchParams, "media_id"),
    applicantType: getOne(searchParams, "applicant_type") as ApplicantType | undefined,
    positionType: getOne(searchParams, "position_type") as PositionType | undefined,
  };
}

/**
 * FR004: 氏名・学校・タグ・現在のステージ・媒体・応募者区分による複合絞り込み条件を
 * Prismaのwhere句に変換する(各条件はAND、タグは複数選択時OR)。
 */
export function buildApplicantWhere(filters: ApplicantFilters): Prisma.ApplicantWhereInput {
  const where: Prisma.ApplicantWhereInput = {};

  if (filters.q) {
    where.OR = [
      { last_name: { contains: filters.q, mode: "insensitive" } },
      { first_name: { contains: filters.q, mode: "insensitive" } },
      { last_name_kana: { contains: filters.q, mode: "insensitive" } },
      { first_name_kana: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.schoolId) {
    where.school_id = filters.schoolId;
  }
  if (filters.tagIds.length > 0) {
    where.tags = { some: { tag_id: { in: filters.tagIds } } };
  }
  if (filters.stageId) {
    where.selection = { current_stage_id: filters.stageId };
  }
  if (filters.mediaId) {
    where.sources = { some: { media_id: filters.mediaId } };
  }
  if (filters.applicantType) {
    where.applicant_type = filters.applicantType;
  }
  if (filters.positionType) {
    where.position_type = filters.positionType;
  }

  return where;
}
