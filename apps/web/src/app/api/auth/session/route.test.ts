import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { adminAuth, createSessionCookie, verifySessionCookie } from "@/lib/firebase/admin";
import { recordAuditLog } from "@/lib/audit-log";
import { POST, DELETE } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/audit-log", () => ({
  recordAuditLog: vi.fn(),
}));
vi.mock("@/lib/firebase/admin", () => ({
  adminAuth: { verifyIdToken: vi.fn() },
  createSessionCookie: vi.fn(),
  verifySessionCookie: vi.fn(),
  SESSION_COOKIE_NAME: "ats_session",
  SESSION_EXPIRES_IN_MS: 1000 * 60 * 60,
}));

const cookieStoreMock = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStoreMock),
  headers: vi.fn(
    async () =>
      new Map([
        ["x-forwarded-for", "203.0.113.1"],
        ["user-agent", "test-agent"],
      ])
  ),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStoreMock.get.mockReturnValue(undefined);
});

describe("POST /api/auth/session", () => {
  it("idTokenが無ければ400", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("idTokenの検証に失敗すれば401", async () => {
    vi.mocked(adminAuth.verifyIdToken).mockRejectedValue(new Error("invalid"));
    const res = await POST(makeRequest({ idToken: "bad" }));
    expect(res.status).toBe(401);
  });

  it("emailが無ければ401", async () => {
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValue({ uid: "u1" } as never);
    const res = await POST(makeRequest({ idToken: "t" }));
    expect(res.status).toBe(401);
  });

  it("未登録/停止中のStaffなら403", async () => {
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValue({ uid: "u1", email: "a@b.com" } as never);
    prismaMock.staff.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ idToken: "t" }));
    expect(res.status).toBe(403);
  });

  it("有効なStaffならStaffSessionを作成し、ログインを監査ログに記録してCookieを発行する", async () => {
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValue({ uid: "u1", email: "a@b.com" } as never);
    prismaMock.staff.findUnique.mockResolvedValue({
      id: "staff-1",
      google_id: "u1",
      is_active: true,
    } as never);
    vi.mocked(createSessionCookie).mockResolvedValue("cookie-value");

    const res = await POST(makeRequest({ idToken: "t" }));

    expect(res.status).toBe(200);
    expect(prismaMock.staffSession.create).toHaveBeenCalledWith({
      data: { staff_id: "staff-1", ip_address: "203.0.113.1", user_agent: "test-agent" },
    });
    expect(recordAuditLog).toHaveBeenCalledWith({ staffId: "staff-1", action: "login" });
    expect(cookieStoreMock.set).toHaveBeenCalledWith(
      "ats_session",
      "cookie-value",
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("google_idが変わっていれば同期する", async () => {
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValue({ uid: "u2", email: "a@b.com" } as never);
    prismaMock.staff.findUnique.mockResolvedValue({
      id: "staff-1",
      google_id: "u1",
      is_active: true,
    } as never);
    vi.mocked(createSessionCookie).mockResolvedValue("cookie-value");

    await POST(makeRequest({ idToken: "t" }));

    expect(prismaMock.staff.update).toHaveBeenCalledWith({
      where: { id: "staff-1" },
      data: { google_id: "u2" },
    });
  });
});

describe("DELETE /api/auth/session", () => {
  it("Cookieが無ければセッション解除処理はせずCookie削除のみ行う", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(prismaMock.staffSession.findFirst).not.toHaveBeenCalled();
    expect(cookieStoreMock.delete).toHaveBeenCalledWith("ats_session");
  });

  it("有効なCookieなら開いているStaffSessionを閉じ、ログアウトを監査ログに記録する", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "cookie-value" });
    vi.mocked(verifySessionCookie).mockResolvedValue({ email: "a@b.com" } as never);
    prismaMock.staff.findUnique.mockResolvedValue({ id: "staff-1" } as never);
    prismaMock.staffSession.findFirst.mockResolvedValue({ id: "session-1" } as never);

    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(prismaMock.staffSession.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { logged_out_at: expect.any(Date) },
    });
    expect(recordAuditLog).toHaveBeenCalledWith({ staffId: "staff-1", action: "logout" });
    expect(cookieStoreMock.delete).toHaveBeenCalledWith("ats_session");
  });

  it("開いているStaffSessionが無ければ更新は呼ばないが、ログアウトは記録する", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "cookie-value" });
    vi.mocked(verifySessionCookie).mockResolvedValue({ email: "a@b.com" } as never);
    prismaMock.staff.findUnique.mockResolvedValue({ id: "staff-1" } as never);
    prismaMock.staffSession.findFirst.mockResolvedValue(null);

    await DELETE();

    expect(prismaMock.staffSession.update).not.toHaveBeenCalled();
    expect(recordAuditLog).toHaveBeenCalledWith({ staffId: "staff-1", action: "logout" });
  });

  it("Cookieが無効(期限切れ等)でもエラーにせずCookie削除は続行する", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "expired" });
    vi.mocked(verifySessionCookie).mockRejectedValue(new Error("expired"));

    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(recordAuditLog).not.toHaveBeenCalled();
    expect(cookieStoreMock.delete).toHaveBeenCalledWith("ats_session");
  });
});
