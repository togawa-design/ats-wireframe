import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/qr/[id]", () => {
  it("存在しないQRコードなら404を返す", async () => {
    prismaMock.qRCode.update.mockRejectedValue(new Error("not found"));

    const res = await GET(new Request("http://localhost/api/qr/missing"), makeContext("missing"));

    expect(res.status).toBe(404);
  });

  it("スキャン数をインクリメントし、遷移先URLへリダイレクトする", async () => {
    prismaMock.qRCode.update.mockResolvedValue({
      id: "qr-1",
      liff_url: "https://example.com/landing",
    } as never);

    const res = await GET(new Request("http://localhost/api/qr/qr-1"), makeContext("qr-1"));

    expect(prismaMock.qRCode.update).toHaveBeenCalledWith({
      where: { id: "qr-1" },
      data: { scan_count: { increment: 1 } },
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://example.com/landing");
  });
});
