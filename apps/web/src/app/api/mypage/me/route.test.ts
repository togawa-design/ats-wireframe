import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line/verify-id-token";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/line/verify-id-token", () => ({
  verifyLiffIdToken: vi.fn(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function makeRequest(authHeader?: string) {
  return new Request("http://localhost/api/mypage/me", {
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}

describe("GET /api/mypage/me", () => {
  it("Authorizationヘッダーが無ければ401", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("ID Tokenの検証に失敗すれば401", async () => {
    vi.mocked(verifyLiffIdToken).mockRejectedValue(new Error("invalid"));
    const res = await GET(makeRequest("Bearer bad-token"));
    expect(res.status).toBe(401);
  });

  it("紐付く応募者がいなければ401", async () => {
    vi.mocked(verifyLiffIdToken).mockResolvedValue("U123");
    prismaMock.applicant.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest("Bearer good-token"));
    expect(res.status).toBe(401);
  });

  it("選考ステージの進捗をステータス付きで返す", async () => {
    vi.mocked(verifyLiffIdToken).mockResolvedValue("U123");
    prismaMock.applicant.findUnique.mockResolvedValue({
      id: "applicant-1",
      last_name: "山田",
      first_name: "太郎",
      department: "機械系",
      phone: "090-1111-2222",
      resume_url: "https://example.com/resume.pdf",
      photo_url: null,
      school: { name: "東京工業大学" },
      selection: {
        current_stage: { order: 2 },
        flow: {
          stages: [
            { id: "s1", name: "エントリー", order: 1 },
            { id: "s2", name: "説明会", order: 2 },
            { id: "s3", name: "1次面接", order: 3 },
          ],
        },
      },
    } as never);

    const res = await GET(makeRequest("Bearer good-token"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.school_name).toBe("東京工業大学");
    expect(body.steps).toEqual([
      { id: "s1", name: "エントリー", status: "done" },
      { id: "s2", name: "説明会", status: "current" },
      { id: "s3", name: "1次面接", status: "upcoming" },
    ]);
    expect(prismaMock.applicant.update).toHaveBeenCalledWith({
      where: { id: "applicant-1" },
      data: { mypage_last_accessed_at: expect.any(Date) },
    });
  });

  it("Selectionが無い応募者はstepsが空配列", async () => {
    vi.mocked(verifyLiffIdToken).mockResolvedValue("U123");
    prismaMock.applicant.findUnique.mockResolvedValue({
      id: "applicant-2",
      last_name: "山田",
      first_name: "太郎",
      department: null,
      phone: null,
      resume_url: null,
      photo_url: null,
      school: null,
      selection: null,
    } as never);

    const res = await GET(makeRequest("Bearer good-token"));
    const body = await res.json();

    expect(body.steps).toEqual([]);
    expect(body.school_name).toBeNull();
  });
});
