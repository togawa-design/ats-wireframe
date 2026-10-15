import { describe, expect, it, vi } from "vitest";
import { getCurrentStaff } from "@/lib/auth";
import { getOfferAndAcceptanceSelections } from "@/lib/analytics";
import { recordAuditLog } from "@/lib/audit-log";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("@/lib/analytics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/analytics")>("@/lib/analytics");
  return {
    ...actual,
    getOfferAndAcceptanceSelections: vi.fn(),
  };
});
vi.mock("@/lib/audit-log", () => ({
  recordAuditLog: vi.fn(),
}));

function makeRequest(query = "") {
  return new Request(`http://localhost/api/export/offers${query}`);
}

describe("GET /api/export/offers", () => {
  it("未ログインなら403", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("権限があればCSVを返し、監査ログにexportを記録する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-1", role: "admin" } as never);
    vi.mocked(getOfferAndAcceptanceSelections).mockResolvedValue([]);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(recordAuditLog).toHaveBeenCalledWith({
      staffId: "staff-1",
      action: "export",
      targetType: "offers",
    });
  });

  it("from/toクエリパラメータを集計期間としてgetOfferAndAcceptanceSelectionsに渡す(FR103)", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-1", role: "admin" } as never);
    vi.mocked(getOfferAndAcceptanceSelections).mockResolvedValue([]);

    await GET(makeRequest("?from=2026-01-01&to=2026-03-31"));

    expect(getOfferAndAcceptanceSelections).toHaveBeenCalledWith({
      positionType: null,
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-03-31T23:59:59.999Z"),
    });
  });

  it("from/toが無ければundefinedを渡す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-1", role: "admin" } as never);
    vi.mocked(getOfferAndAcceptanceSelections).mockResolvedValue([]);

    await GET(makeRequest());

    expect(getOfferAndAcceptanceSelections).toHaveBeenCalledWith({
      positionType: null,
      from: undefined,
      to: undefined,
    });
  });
});
