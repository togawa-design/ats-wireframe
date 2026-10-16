import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, PositionType } from "@/generated/prisma/client";

/** FR095(職種区分)・FR103(集計期間)の絞り込み条件。 */
export type AnalyticsFilters = {
  positionType?: PositionType | null;
  from?: Date | null;
  to?: Date | null;
};

/** FR103: `YYYY-MM-DD`形式の開始日文字列をその日の開始時刻のDateに変換する。 */
export function parseFromDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** FR103: `YYYY-MM-DD`形式の終了日文字列をその日の終了時刻のDateに変換する(当日分を含めるため)。 */
export function parseToDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** FR103: 集計対象期間(応募者の登録日時基準)をPrismaのDateTimeFilterに変換する。 */
function dateRangeFilter(filters: AnalyticsFilters): Prisma.DateTimeFilter | undefined {
  if (!filters.from && !filters.to) return undefined;
  return {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {}),
  };
}

/**
 * FR095(職種区分)・FR103(集計期間)の絞り込み条件をApplicant向けwhereに変換する。
 * 職種区分が未設定の応募者は、どの職種区分に制限されたスタッフからも閲覧可能とする。
 */
function applicantWhere(filters: AnalyticsFilters): Prisma.ApplicantWhereInput {
  const positionType = filters.positionType ?? null;
  return {
    ...(positionType ? { OR: [{ position_type: positionType }, { position_type: null }] } : {}),
    created_at: dateRangeFilter(filters),
  };
}

/**
 * FR050: 統合ファネル遷移率。
 * 「フローにないステージでも、それより先に進んでいれば通過扱い」のバイパスカウント
 * ロジック(stage_type の order で判定)。MVPでは単一フローのみ対応。
 */
export async function getFunnelData(filters: AnalyticsFilters = {}) {
  const flow = await prisma.selectionFlow.findFirst({
    where: { is_default: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (!flow) return [];

  const selections = await prisma.selection.findMany({
    where: { applicant: applicantWhere(filters) },
    select: { current_stage: { select: { order: true } } },
  });

  return flow.stages.map((stage, index) => {
    const count = selections.filter((s) => s.current_stage.order >= stage.order).length;
    const prevCount =
      index === 0
        ? null
        : selections.filter((s) => s.current_stage.order >= flow.stages[index - 1].order).length;
    const conversionFromPrev =
      prevCount === null || prevCount === 0 ? null : Math.round((count / prevCount) * 1000) / 10;
    return { stageId: stage.id, stageName: stage.name, count, conversionFromPrev };
  });
}

/** 流入元(媒体・QRコード)ごとの流入数・承諾率(FR042)を集計するヘルパー。 */
function summarizeAcceptance(
  currentStages: ({ stage_type: string } | null)[]
): { count: number; acceptanceRate: number | null } {
  const count = currentStages.length;
  if (count === 0) return { count: 0, acceptanceRate: null };
  const accepted = currentStages.filter((stage) => stage?.stage_type === "acceptance").length;
  return { count, acceptanceRate: Math.round((accepted / count) * 1000) / 10 };
}

/** FR051/FR102/FR042: 媒体別の流入数・承諾率(ドリルダウン用にmedia_idも返す)。 */
export async function getMediaBreakdown(filters: AnalyticsFilters = {}) {
  const [mediaList, sources] = await Promise.all([
    prisma.media.findMany({ orderBy: { name: "asc" } }),
    prisma.applicantSource.findMany({
      where: { media_id: { not: null }, applicant: applicantWhere(filters) },
      select: {
        media_id: true,
        applicant: { select: { selection: { select: { current_stage: true } } } },
      },
    }),
  ]);

  const byMedia = new Map<string, ({ stage_type: string } | null)[]>();
  for (const source of sources) {
    const mediaId = source.media_id as string;
    const list = byMedia.get(mediaId) ?? [];
    list.push(source.applicant.selection?.current_stage ?? null);
    byMedia.set(mediaId, list);
  }

  return mediaList.map((media) => {
    const { count, acceptanceRate } = summarizeAcceptance(byMedia.get(media.id) ?? []);
    return { id: media.id, name: media.name, count, acceptanceRate };
  });
}

/** FR042: QRコード別の流入数・承諾率(データがある分のみ、流入数が多い順)。 */
export async function getQrCodeBreakdown(filters: AnalyticsFilters = {}) {
  const [qrCodes, sources] = await Promise.all([
    prisma.qRCode.findMany(),
    prisma.applicantSource.findMany({
      where: { qr_code_id: { not: null }, applicant: applicantWhere(filters) },
      select: {
        qr_code_id: true,
        applicant: { select: { selection: { select: { current_stage: true } } } },
      },
    }),
  ]);

  const byQrCode = new Map<string, ({ stage_type: string } | null)[]>();
  for (const source of sources) {
    const qrCodeId = source.qr_code_id as string;
    const list = byQrCode.get(qrCodeId) ?? [];
    list.push(source.applicant.selection?.current_stage ?? null);
    byQrCode.set(qrCodeId, list);
  }

  return qrCodes
    .map((qrCode) => {
      const { count, acceptanceRate } = summarizeAcceptance(byQrCode.get(qrCode.id) ?? []);
      return {
        id: qrCode.id,
        label: qrCode.label,
        scanCount: qrCode.scan_count,
        entryCount: count,
        acceptanceRate,
      };
    })
    .filter((qrCode) => qrCode.entryCount > 0)
    .sort((a, b) => b.entryCount - a.entryCount);
}

/** FR051/FR102: 学校別の流入数(データがある学校のみ、多い順。ドリルダウン用にschool_idも返す)。 */
export async function getSchoolBreakdown(filters: AnalyticsFilters = {}) {
  const grouped = await prisma.applicant.groupBy({
    by: ["school_id"],
    where: { school_id: { not: null }, ...applicantWhere(filters) },
    _count: { _all: true },
  });
  if (grouped.length === 0) return [];

  const schools = await prisma.school.findMany({
    where: { id: { in: grouped.map((g) => g.school_id as string) } },
  });
  const nameById = new Map(schools.map((s) => [s.id, s.name]));

  return grouped
    .map((g) => ({
      id: g.school_id as string,
      name: nameById.get(g.school_id as string) ?? "不明",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

/** FR052: 内定者・承諾者一覧(現在のステージがoffer/acceptanceの応募者)。 */
export async function getOfferAndAcceptanceSelections(filters: AnalyticsFilters = {}) {
  return prisma.selection.findMany({
    where: {
      current_stage: { stage_type: { in: ["offer", "acceptance"] } },
      applicant: applicantWhere(filters),
    },
    include: { applicant: { include: { school: true } }, current_stage: true, assignee: true },
    orderBy: { applicant: { created_at: "desc" } },
  });
}

/** FR053: 全データエクスポート用の応募者一覧(FR103の集計期間は適用しない。全件が対象のエクスポートのため)。 */
export async function getAllApplicantsForExport(positionType: PositionType | null = null) {
  return prisma.applicant.findMany({
    where: applicantWhere({ positionType }),
    include: { school: true, selection: { include: { current_stage: true } } },
    orderBy: { created_at: "desc" },
  });
}
