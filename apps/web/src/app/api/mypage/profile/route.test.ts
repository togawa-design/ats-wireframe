import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line/verify-id-token";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/line/verify-id-token", () => ({
  verifyLiffIdToken: vi.fn(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function makeRequest(body: unknown, authHeader?: string) {
  return new Request("http://localhost/api/mypage/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mypage/profile", () => {
  it("Authorizationヘッダーが無ければ401", async () => {
    const res = await POST(makeRequest({ phone: "090-1234-5678" }));
    expect(res.status).toBe(401);
    expect(prismaMock.applicant.update).not.toHaveBeenCalled();
  });

  it("電話番号が空なら400", async () => {
    vi.mocked(verifyLiffIdToken).mockResolvedValue("U123");
    prismaMock.applicant.findUnique.mockResolvedValue({ id: "applicant-1" } as never);

    const res = await POST(makeRequest({ phone: "  " }, "Bearer token"));

    expect(res.status).toBe(400);
    expect(prismaMock.applicant.update).not.toHaveBeenCalled();
  });

  it("有効な電話番号なら更新する", async () => {
    vi.mocked(verifyLiffIdToken).mockResolvedValue("U123");
    prismaMock.applicant.findUnique.mockResolvedValue({ id: "applicant-1" } as never);

    const res = await POST(makeRequest({ phone: "090-1234-5678" }, "Bearer token"));

    expect(res.status).toBe(200);
    expect(prismaMock.applicant.update).toHaveBeenCalledWith({
      where: { id: "applicant-1" },
      data: { phone: "090-1234-5678" },
    });
  });
});
