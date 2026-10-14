import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-log";
import { advanceStage, moveToStage, setResult } from "./actions";

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
const mockStaff = { id: "staff-1", name: "テスト太郎", role: "admin" } as never;

const stages = [
  { id: "stage-1", stage_type: "entry" },
  { id: "stage-2", stage_type: "screening" },
  { id: "stage-3", stage_type: "offer" },
];

describe("advanceStage", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(advanceStage("selection-1")).rejects.toThrow("ログインが必要です");
  });

  it("面接官ロールでは権限エラーになる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "interviewer" } as never);
    await expect(advanceStage("selection-1")).rejects.toThrow("この操作を行う権限がありません");
    expect(prismaMock.selection.update).not.toHaveBeenCalled();
  });

  it("次のステージがあれば更新と履歴作成を行う", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.selection.findUniqueOrThrow.mockResolvedValue({
      id: "selection-1",
      current_stage_id: "stage-1",
      flow: { stages },
    } as never);

    await advanceStage("selection-1");

    expect(prismaMock.selection.update).toHaveBeenCalledWith({
      where: { id: "selection-1" },
      data: { current_stage_id: "stage-2" },
    });
    expect(prismaMock.selectionHistory.create).toHaveBeenCalledWith({
      data: {
        selection_id: "selection-1",
        from_stage_id: "stage-1",
        to_stage_id: "stage-2",
        changed_by: "staff-1",
      },
    });
    expect(recordAuditLog).toHaveBeenCalledWith({
      staffId: "staff-1",
      action: "status_change",
      targetType: "Selection",
      targetId: "selection-1",
      beforeValue: { stage_id: "stage-1" },
      afterValue: { stage_id: "stage-2" },
    });
  });

  it("進んだ先がofferステージなら監査ログのactionをofferにする", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.selection.findUniqueOrThrow.mockResolvedValue({
      id: "selection-1",
      current_stage_id: "stage-2",
      flow: { stages },
    } as never);

    await advanceStage("selection-1");

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "offer" })
    );
  });

  it("最終ステージの場合は例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.selection.findUniqueOrThrow.mockResolvedValue({
      id: "selection-1",
      current_stage_id: "stage-3",
      flow: { stages },
    } as never);

    await expect(advanceStage("selection-1")).rejects.toThrow("既に最終ステージです");
    expect(prismaMock.selection.update).not.toHaveBeenCalled();
  });
});

describe("moveToStage", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(moveToStage("selection-1", "stage-3")).rejects.toThrow("ログインが必要です");
  });

  it("面接官ロールでは権限エラーになる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "interviewer" } as never);
    await expect(moveToStage("selection-1", "stage-3")).rejects.toThrow(
      "この操作を行う権限がありません"
    );
  });

  it("任意のステージへ移動し履歴を作成する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.selection.findUniqueOrThrow.mockResolvedValue({
      id: "selection-1",
      current_stage_id: "stage-1",
    } as never);
    prismaMock.selectionStage.findUniqueOrThrow.mockResolvedValue({
      id: "stage-3",
      stage_type: "offer",
    } as never);

    await moveToStage("selection-1", "stage-3");

    expect(prismaMock.selection.update).toHaveBeenCalledWith({
      where: { id: "selection-1" },
      data: { current_stage_id: "stage-3" },
    });
    expect(prismaMock.selectionHistory.create).toHaveBeenCalledWith({
      data: {
        selection_id: "selection-1",
        from_stage_id: "stage-1",
        to_stage_id: "stage-3",
        changed_by: "staff-1",
      },
    });
    expect(recordAuditLog).toHaveBeenCalledWith({
      staffId: "staff-1",
      action: "offer",
      targetType: "Selection",
      targetId: "selection-1",
      beforeValue: { stage_id: "stage-1" },
      afterValue: { stage_id: "stage-3" },
    });
  });

  it("移動先がacceptanceステージなら監査ログのactionをacceptanceにする", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.selection.findUniqueOrThrow.mockResolvedValue({
      id: "selection-1",
      current_stage_id: "stage-1",
    } as never);
    prismaMock.selectionStage.findUniqueOrThrow.mockResolvedValue({
      id: "stage-4",
      stage_type: "acceptance",
    } as never);

    await moveToStage("selection-1", "stage-4");

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "acceptance" })
    );
  });

  it("移動先が現在のステージと同じなら何もしない", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.selection.findUniqueOrThrow.mockResolvedValue({
      id: "selection-1",
      current_stage_id: "stage-2",
    } as never);

    await moveToStage("selection-1", "stage-2");

    expect(prismaMock.selection.update).not.toHaveBeenCalled();
    expect(prismaMock.selectionHistory.create).not.toHaveBeenCalled();
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});

describe("setResult", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(setResult("selection-1", "passed")).rejects.toThrow("ログインが必要です");
  });

  it("ログイン済みなら結果を更新し、監査ログに記録する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.selection.update.mockResolvedValue({ result: "passed" } as never);

    await setResult("selection-1", "passed");

    expect(prismaMock.selection.update).toHaveBeenCalledWith({
      where: { id: "selection-1" },
      data: { result: "passed" },
    });
    expect(recordAuditLog).toHaveBeenCalledWith({
      staffId: "staff-1",
      action: "status_change",
      targetType: "Selection",
      targetId: "selection-1",
      afterValue: { result: "passed" },
    });
  });
});
