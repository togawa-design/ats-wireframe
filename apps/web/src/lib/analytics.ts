import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * FR050: 統合ファネル遷移率。
 * 「フローにないステージでも、それより先に進んでいれば通過扱い」のバイパスカウント
 * ロジック(stage_type の order で判定)。MVPでは単一フローのみ対応。
 */
export async function getFunnelData() {
  const flow = await prisma.selectionFlow.findFirst({
    where: { is_default: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (!flow) return [];

  const selections = await prisma.selection.findMany({
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
export async function getMediaBreakdown() {
  const [mediaList, grouped] = await Promise.all([
    prisma.media.findMany({ orderBy: { name: "asc" } }),
    prisma.applicantSource.groupBy({ by: ["media_id"], _count: { _all: true } }),
  ]);
  const countByMedia = new Map(grouped.map((g) => [g.media_id, g._count._all]));
  return mediaList.map((media) => ({ name: media.name, count: countByMedia.get(media.id) ?? 0 }));
}

/** FR051: 学校別の流入数(データがある学校のみ、多い順)。 */
export async function getSchoolBreakdown() {
  const grouped = await prisma.applicant.groupBy({
    by: ["school_id"],
    where: { school_id: { not: null } },
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
export async function getOfferAndAcceptanceSelections() {
  return prisma.selection.findMany({
    where: { current_stage: { stage_type: { in: ["offer", "acceptance"] } } },
    include: { applicant: { include: { school: true } }, current_stage: true, assignee: true },
    orderBy: { applicant: { created_at: "desc" } },
  });
}

/** FR053: 全データエクスポート用の応募者一覧。 */
export async function getAllApplicantsForExport() {
  return prisma.applicant.findMany({
    include: { school: true, selection: { include: { current_stage: true } } },
    orderBy: { created_at: "desc" },
  });
}
