import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { updateColumnPreference } from "./column-actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe("updateColumnPreference", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(updateColumnPreference(["email"])).rejects.toThrow("ログインが必要です");
    expect(prismaMock.staffColumnPreference.upsert).not.toHaveBeenCalled();
  });

  it("有効な列配列をそのままupsertする(閲覧のみロールでも保存可能)", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-1", role: "viewer" } as never);

    await updateColumnPreference(["school", "email"]);

    expect(prismaMock.staffColumnPreference.upsert).toHaveBeenCalledWith({
      where: { staff_id: "staff-1" },
      create: { staff_id: "staff-1", columns: ["school", "email"] },
      update: { columns: ["school", "email"] },
    });
  });

  it("未知のキーを取り除いてから保存する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-1", role: "admin" } as never);

    await updateColumnPreference(["email", "unknown_key" as never]);

    expect(prismaMock.staffColumnPreference.upsert).toHaveBeenCalledWith({
      where: { staff_id: "staff-1" },
      create: { staff_id: "staff-1", columns: ["email"] },
      update: { columns: ["email"] },
    });
  });
});
