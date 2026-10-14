import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "./audit-log";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

async function mockHeaders(value: string | null) {
  const { headers } = await import("next/headers");
  vi.mocked(headers).mockResolvedValue(
    new Map(value ? [["x-forwarded-for", value]] : []) as never
  );
}

describe("recordAuditLog", () => {
  it("x-forwarded-forの先頭IPを記録する", async () => {
    await mockHeaders("203.0.113.1, 10.0.0.1");

    await recordAuditLog({ staffId: "staff-1", action: "login" });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        staff_id: "staff-1",
        action: "login",
        target_type: undefined,
        target_id: undefined,
        before_value: undefined,
        after_value: undefined,
        ip_address: "203.0.113.1",
      },
    });
  });

  it("x-forwarded-forが無ければunknownを記録する", async () => {
    await mockHeaders(null);

    await recordAuditLog({ staffId: "staff-1", action: "logout" });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ip_address: "unknown" }),
    });
  });

  it("target/before/afterを指定すればそのまま記録する", async () => {
    await mockHeaders("203.0.113.1");

    await recordAuditLog({
      staffId: "staff-1",
      action: "status_change",
      targetType: "Selection",
      targetId: "selection-1",
      beforeValue: { stage: "entry" },
      afterValue: { stage: "screening" },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        staff_id: "staff-1",
        action: "status_change",
        target_type: "Selection",
        target_id: "selection-1",
        before_value: { stage: "entry" },
        after_value: { stage: "screening" },
        ip_address: "203.0.113.1",
      },
    });
  });
});
