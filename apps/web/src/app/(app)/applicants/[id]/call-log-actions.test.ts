import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-log";
import { createCallLog, updateApplicantCallStatus } from "./call-log-actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("@/lib/audit-log", () => ({
  recordAuditLog: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockStaff = { id: "staff-1", role: "admin" } as never;

function buildForm(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

describe("createCallLog", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(
      createCallLog("applicant-1", buildForm({ called_at: "2026-10-15T10:00", result: "不在" }))
    ).rejects.toThrow("ログインが必要です");
    expect(prismaMock.callLog.create).not.toHaveBeenCalled();
  });

  it("閲覧のみロールでは権限エラーになる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "viewer" } as never);
    await expect(
      createCallLog("applicant-1", buildForm({ called_at: "2026-10-15T10:00", result: "不在" }))
    ).rejects.toThrow("この操作を行う権限がありません");
  });

  it("架電日時が無ければ例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await expect(createCallLog("applicant-1", buildForm({ result: "不在" }))).rejects.toThrow(
      "架電日時を入力してください"
    );
  });

  it("架電結果が無ければ例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await expect(
      createCallLog("applicant-1", buildForm({ called_at: "2026-10-15T10:00" }))
    ).rejects.toThrow("架電結果を選択してください");
  });

  it("有効な入力ならCallLogを作成し監査ログを記録する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);

    await createCallLog(
      "applicant-1",
      buildForm({ called_at: "2026-10-15T10:00", result: "つながった", note: "来週再架電予定" })
    );

    expect(prismaMock.callLog.create).toHaveBeenCalledWith({
      data: {
        applicant_id: "applicant-1",
        staff_id: "staff-1",
        called_at: new Date("2026-10-15T10:00"),
        result: "つながった",
        note: "来週再架電予定",
      },
    });
    expect(recordAuditLog).toHaveBeenCalledWith({
      staffId: "staff-1",
      action: "edit_applicant",
      targetType: "Applicant",
      targetId: "applicant-1",
      afterValue: { call_log: { called_at: "2026-10-15T10:00", result: "つながった" } },
    });
  });

  it("内容が空ならnoteはnullで保存する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);

    await createCallLog("applicant-1", buildForm({ called_at: "2026-10-15T10:00", result: "不在" }));

    expect(prismaMock.callLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ note: null }),
    });
  });
});

describe("updateApplicantCallStatus", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(updateApplicantCallStatus("applicant-1", "callback_needed")).rejects.toThrow(
      "ログインが必要です"
    );
    expect(prismaMock.applicant.update).not.toHaveBeenCalled();
  });

  it("閲覧のみロールでは権限エラーになる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "viewer" } as never);
    await expect(updateApplicantCallStatus("applicant-1", "callback_needed")).rejects.toThrow(
      "この操作を行う権限がありません"
    );
  });

  it("call_statusを更新し監査ログを記録する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);

    await updateApplicantCallStatus("applicant-1", "no_answer");

    expect(prismaMock.applicant.update).toHaveBeenCalledWith({
      where: { id: "applicant-1" },
      data: { call_status: "no_answer" },
    });
    expect(recordAuditLog).toHaveBeenCalledWith({
      staffId: "staff-1",
      action: "edit_applicant",
      targetType: "Applicant",
      targetId: "applicant-1",
      afterValue: { call_status: "no_answer" },
    });
  });
});
