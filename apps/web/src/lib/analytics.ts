import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, PositionType } from "@/generated/prisma/client";

/** FR095: 職種区分によるアクセス制限をApplicant向けwhereに変換する(未設定は全員が閲覧可能)。 */
function positionTypeWhere(positionType: PositionType | null): Prisma.ApplicantWhereInput {
  return positionType ? { OR: [{ position_type: positionType }, { position_type: null }] } : {};
}

/**
 * FR050: 統合ファネル遷移率。
 * 「フローにないステージでも、それより先に進んでいれば通過扱い」のバイパスカウント
 * ロジック(stage_type の order で判定)。MVPでは単一フローのみ対応。
 */
export async function getFunnelData(positionType: PositionType | null = null) {
  const flow = await prisma.selectionFlow.findFirst({
    where: { is_default: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (!flow) return [];

  const selections = await prisma.selection.findMany({
    where: { applicant: positionTypeWhere(positionType) },
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

/** FR051: 媒体別の流入数。 */
export async function getMediaBreakdown(positionType: PositionType | null = null) {
  const [mediaList, grouped] = await Promise.all([
    prisma.media.findMany({ orderBy: { name: "asc" } }),
    prisma.applicantSource.groupBy({
      by: ["media_id"],
      where: { applicant: positionTypeWhere(positionType) },
      _count: { _all: true },
    }),
  ]);
  const countByMedia = new Map(grouped.map((g) => [g.media_id, g._count._all]));
  return mediaList.map((media) => ({ name: media.name, count: countByMedia.get(media.id) ?? 0 }));
}

/** FR051: 学校別の流入数(データがある学校のみ、多い順)。 */
export async function getSchoolBreakdown(positionType: PositionType | null = null) {
  const grouped = await prisma.applicant.groupBy({
    by: ["school_id"],
    where: { school_id: { not: null }, ...positionTypeWhere(positionType) },
    _count: { _all: true },
  });
  if (grouped.length === 0) return [];

  const schools = await prisma.school.findMany({
    where: { id: { in: grouped.map((g) => g.school_id as string) } },
  });
  const nameById = new Map(schools.map((s) => [s.id, s.name]));

  return grouped
    .map((g) => ({ name: nameById.get(g.school_id as string) ?? "不明", count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

/** FR052: 内定者・承諾者一覧(現在のステージがoffer/acceptanceの応募者)。 */
export async function getOfferAndAcceptanceSelections(positionType: PositionType | null = null) {
  return prisma.selection.findMany({
    where: {
      current_stage: { stage_type: { in: ["offer", "acceptance"] } },
      applicant: positionTypeWhere(positionType),
    },
    include: { applicant: { include: { school: true } }, current_stage: true, assignee: true },
    orderBy: { applicant: { created_at: "desc" } },
  });
}

/** FR053: 全データエクスポート用の応募者一覧。 */
export async function getAllApplicantsForExport(positionType: PositionType | null = null) {
  return prisma.applicant.findMany({
    where: positionTypeWhere(positionType),
    include: { school: true, selection: { include: { current_stage: true } } },
    orderBy: { created_at: "desc" },
  });
}
