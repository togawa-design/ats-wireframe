import { describe, expect, it, vi } from "vitest";
import { getCurrentStaff } from "@/lib/auth";
import { getAllApplicantsForExport } from "@/lib/analytics";
import { recordAuditLog } from "@/lib/audit-log";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({
  getAllApplicantsForExport: vi.fn(),
}));
vi.mock("@/lib/audit-log", () => ({
  recordAuditLog: vi.fn(),
}));

describe("GET /api/export/applicants", () => {
  it("未ログインなら403", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("面接官ロールでは403", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-1", role: "interviewer" } as never);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("権限があればCSVを返し、監査ログにexportを記録する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-1", role: "admin" } as never);
    vi.mocked(getAllApplicantsForExport).mockResolvedValue([]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(recordAuditLog).toHaveBeenCalledWith({
      staffId: "staff-1",
      action: "export",
      targetType: "applicants",
    });
  });
});
