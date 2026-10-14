import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { AuditAction, Prisma } from "@/generated/prisma/client";

/** FR088: 重要操作を監査ログ(AuditLog)に記録する。INSERT ONLYで削除・更新は行わない。 */
export async function recordAuditLog(params: {
  staffId: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  beforeValue?: Prisma.InputJsonValue;
  afterValue?: Prisma.InputJsonValue;
}) {
  const headersList = await headers();
  const ipAddress = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  await prisma.auditLog.create({
    data: {
      staff_id: params.staffId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      before_value: params.beforeValue,
      after_value: params.afterValue,
      ip_address: ipAddress,
    },
  });
}
