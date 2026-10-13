import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/line/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/line/register", () => {
  it("token/lineUserIdが無ければ400", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("トークンが存在しなければ404", async () => {
    prismaMock.lineRegistrationToken.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ token: "t", lineUserId: "U1" }));
    expect(res.status).toBe(404);
  });

  it("使用済みトークンなら409", async () => {
    prismaMock.lineRegistrationToken.findUnique.mockResolvedValue({
      token: "t",
      applicant_id: "applicant-1",
      used_at: new Date(),
      expires_at: new Date(Date.now() + 10000),
    } as never);
    const res = await POST(makeRequest({ token: "t", lineUserId: "U1" }));
    expect(res.status).toBe(409);
  });

  it("期限切れトークンなら410", async () => {
    prismaMock.lineRegistrationToken.findUnique.mockResolvedValue({
      token: "t",
      applicant_id: "applicant-1",
      used_at: null,
      expires_at: new Date(Date.now() - 1000),
    } as never);
    const res = await POST(makeRequest({ token: "t", lineUserId: "U1" }));
    expect(res.status).toBe(410);
  });

  it("別応募者が既にそのLINEアカウントを使っていれば409", async () => {
    prismaMock.lineRegistrationToken.findUnique.mockResolvedValue({
      token: "t",
      applicant_id: "applicant-1",
      used_at: null,
      expires_at: new Date(Date.now() + 10000),
    } as never);
    prismaMock.applicant.findUnique.mockResolvedValue({ id: "applicant-2" } as never);
    const res = await POST(makeRequest({ token: "t", lineUserId: "U1" }));
    expect(res.status).toBe(409);
  });

  it("有効なトークンなら応募者のline_user_idを更新しトークンを使用済みにする", async () => {
    prismaMock.lineRegistrationToken.findUnique.mockResolvedValue({
      token: "t",
      applicant_id: "applicant-1",
      used_at: null,
      expires_at: new Date(Date.now() + 10000),
    } as never);
    prismaMock.applicant.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ token: "t", lineUserId: "U1" }));

    expect(res.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.applicant.update).toHaveBeenCalledWith({
      where: { id: "applicant-1" },
      data: { line_user_id: "U1", line_linked_at: expect.any(Date) },
    });
    expect(prismaMock.lineRegistrationToken.update).toHaveBeenCalledWith({
      where: { token: "t" },
      data: { used_at: expect.any(Date) },
    });
  });
});
