import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { addStage, renameStage, changeStageType, moveStage, deleteStage } from "./actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const admin = { id: "staff-1", role: "admin" } as never;
const viewer = { id: "staff-2", role: "viewer" } as never;

function buildForm(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

describe("addStage", () => {
  it("閲覧のみロールでは権限エラーになる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(viewer);
    await expect(
      addStage(buildForm({ flow_id: "flow-1", name: "書類選考", stage_type: "screening" }))
    ).rejects.toThrow("この操作を行う権限がありません");
  });

  it("既存ステージが無ければorder=1で作成する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    prismaMock.selectionStage.findFirst.mockResolvedValue(null);

    await addStage(buildForm({ flow_id: "flow-1", name: "エントリー", stage_type: "entry" }));

    expect(prismaMock.selectionStage.create).toHaveBeenCalledWith({
      data: { flow_id: "flow-1", name: "エントリー", stage_type: "entry", order: 1 },
    });
  });

  it("既存ステージの最大order+1で作成する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    prismaMock.selectionStage.findFirst.mockResolvedValue({ order: 3 } as never);

    await addStage(buildForm({ flow_id: "flow-1", name: "最終面接", stage_type: "interview_final" }));

    expect(prismaMock.selectionStage.create).toHaveBeenCalledWith({
      data: { flow_id: "flow-1", name: "最終面接", stage_type: "interview_final", order: 4 },
    });
  });
});

describe("renameStage", () => {
  it("空文字なら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    await expect(renameStage("stage-1", "  ")).rejects.toThrow("ステージ名を入力してください");
  });

  it("有効な名前なら更新する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    await renameStage("stage-1", "書類選考2");
    expect(prismaMock.selectionStage.update).toHaveBeenCalledWith({
      where: { id: "stage-1" },
      data: { name: "書類選考2" },
    });
  });
});

describe("moveStage", () => {
  it("上に隣接ステージがあれば並び順を入れ替える", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    prismaMock.selectionStage.findUniqueOrThrow.mockResolvedValue({
      id: "stage-2",
      flow_id: "flow-1",
      order: 2,
    } as never);
    prismaMock.selectionStage.findFirst.mockResolvedValue({ id: "stage-1", order: 1 } as never);

    await moveStage("stage-2", "up");

    expect(prismaMock.selectionStage.update).toHaveBeenCalledWith({
      where: { id: "stage-2" },
      data: { order: 1 },
    });
    expect(prismaMock.selectionStage.update).toHaveBeenCalledWith({
      where: { id: "stage-1" },
      data: { order: 2 },
    });
  });

  it("既に端にある場合は何もしない", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    prismaMock.selectionStage.findUniqueOrThrow.mockResolvedValue({
      id: "stage-1",
      flow_id: "flow-1",
      order: 1,
    } as never);
    prismaMock.selectionStage.findFirst.mockResolvedValue(null);

    await moveStage("stage-1", "up");

    expect(prismaMock.selectionStage.update).not.toHaveBeenCalled();
  });
});

describe("deleteStage", () => {
  it("使用中で削除に失敗した場合はわかりやすいエラーにする", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    prismaMock.selectionStage.delete.mockRejectedValue(new Error("FK violation"));

    await expect(deleteStage("stage-1")).rejects.toThrow("このステージは使用中のため削除できません");
  });

  it("未使用なら削除できる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    prismaMock.selectionStage.delete.mockResolvedValue({} as never);

    await deleteStage("stage-1");
    expect(prismaMock.selectionStage.delete).toHaveBeenCalledWith({ where: { id: "stage-1" } });
  });
});

describe("changeStageType", () => {
  it("ログイン済みなら種別を更新する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    await changeStageType("stage-1", "offer");
    expect(prismaMock.selectionStage.update).toHaveBeenCalledWith({
      where: { id: "stage-1" },
      data: { stage_type: "offer" },
    });
  });
});
