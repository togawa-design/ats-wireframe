import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { createInterview, deleteInterview } from "./actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockStaff = { id: "staff-1", name: "テスト太郎", role: "admin" } as never;

function buildForm(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

describe("createInterview", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    const form = buildForm({
      selection_id: "selection-1",
      interviewer_id: "staff-2",
      scheduled_at: "2027-01-01T10:00",
    });

    await expect(createInterview(form)).rejects.toThrow("ログインが必要です");
  });

  it("必須項目が空なら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const form = buildForm({ selection_id: "", interviewer_id: "", scheduled_at: "" });

    await expect(createInterview(form)).rejects.toThrow("応募者(選考)を選択してください");
  });

  it("閲覧のみロールでは権限エラーになる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "viewer" } as never);
    const form = buildForm({
      selection_id: "selection-1",
      interviewer_id: "staff-2",
      scheduled_at: "2027-01-01T10:00",
    });

    await expect(createInterview(form)).rejects.toThrow("この操作を行う権限がありません");
  });

  it("面接官ロールは面接記録を作成できる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "interviewer" } as never);
    prismaMock.selection.findUniqueOrThrow.mockResolvedValue({
      current_stage_id: "stage-1",
    } as never);
    const form = buildForm({
      selection_id: "selection-1",
      interviewer_id: "staff-2",
      scheduled_at: "2027-01-01T10:00",
    });

    await createInterview(form);
    expect(prismaMock.interview.create).toHaveBeenCalled();
  });

  it("有効な入力で面接記録を作成する(現在のステージを自動セット)", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.selection.findUniqueOrThrow.mockResolvedValue({
      current_stage_id: "stage-1",
    } as never);
    const form = buildForm({
      selection_id: "selection-1",
      interviewer_id: "staff-2",
      scheduled_at: "2027-01-01T10:00",
      score: "4",
      notes: "良い印象",
    });

    await createInterview(form);

    expect(prismaMock.interview.create).toHaveBeenCalledWith({
      data: {
        selection_id: "selection-1",
        stage_id: "stage-1",
        interviewer_id: "staff-2",
        scheduled_at: new Date("2027-01-01T10:00"),
        score: 4,
        notes: "良い印象",
      },
    });
  });
});

describe("deleteInterview", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(deleteInterview("interview-1")).rejects.toThrow("ログインが必要です");
  });

  it("ログイン済みなら指定IDの面接記録を削除する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await deleteInterview("interview-1");
    expect(prismaMock.interview.delete).toHaveBeenCalledWith({ where: { id: "interview-1" } });
  });

  it("面接官ロールは削除できない(評価入力のみ)", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "interviewer" } as never);
    await expect(deleteInterview("interview-1")).rejects.toThrow(
      "この操作を行う権限がありません"
    );
    expect(prismaMock.interview.delete).not.toHaveBeenCalled();
  });
});
