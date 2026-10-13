import "server-only";
import { prisma } from "@/lib/prisma";

/** 新規応募者に対し、デフォルト選考フローの最初のステージでSelectionを作成する。 */
export async function createDefaultSelection(applicantId: string) {
  const defaultFlow = await prisma.selectionFlow.findFirst({
    where: { is_default: true, is_active: true },
    include: { stages: { orderBy: { order: "asc" }, take: 1 } },
  });
  if (defaultFlow && defaultFlow.stages[0]) {
    await prisma.selection.create({
      data: {
        applicant_id: applicantId,
        flow_id: defaultFlow.id,
        current_stage_id: defaultFlow.stages[0].id,
      },
    });
  }
}
