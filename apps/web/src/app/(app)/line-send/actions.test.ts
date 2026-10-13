import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { sendTextMessage } from "@/lib/line/client";
import { sendBulkLineMessage } from "./actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("@/lib/line/client", () => ({
  sendTextMessage: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockStaff = { id: "staff-1", name: "テスト太郎", role: "admin" } as never;

function buildForm(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

describe("sendBulkLineMessage", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(sendBulkLineMessage(buildForm({ text: "hi" }))).rejects.toThrow(
      "ログインが必要です"
    );
  });

  it("面接官ロールでは権限エラーになる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "interviewer" } as never);
    await expect(sendBulkLineMessage(buildForm({ text: "hi" }))).rejects.toThrow(
      "この操作を行う権限がありません"
    );
  });

  it("本文が空なら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await expect(sendBulkLineMessage(buildForm({ text: "  " }))).rejects.toThrow(
      "メッセージ本文を入力してください"
    );
  });

  it("差し込み変数を展開して新卒・LINE連携済みの応募者にのみ送信する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.findMany.mockResolvedValue([
      { id: "a1", last_name: "山田", first_name: "太郎", line_user_id: "U1" },
      { id: "a2", last_name: "鈴木", first_name: "花子", line_user_id: "U2" },
    ] as never);
    vi.mocked(sendTextMessage).mockResolvedValue(undefined);

    const result = await sendBulkLineMessage(
      buildForm({ text: "{{last_name}} {{first_name}} さん、こんにちは" })
    );

    expect(prismaMock.applicant.findMany).toHaveBeenCalledWith({
      where: { hire_type: "new_grad", line_user_id: { not: null } },
      select: { id: true, last_name: true, first_name: true, line_user_id: true },
    });
    expect(sendTextMessage).toHaveBeenNthCalledWith(1, "U1", "山田 太郎 さん、こんにちは");
    expect(sendTextMessage).toHaveBeenNthCalledWith(2, "U2", "鈴木 花子 さん、こんにちは");
    expect(prismaMock.lineMessage.create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ successCount: 2, failureCount: 0, total: 2 });
  });

  it("タグ指定時はApplicantTagでの絞り込み条件を付与する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.findMany.mockResolvedValue([]);

    await sendBulkLineMessage(buildForm({ text: "hi", tag_id: "tag-1" }));

    expect(prismaMock.applicant.findMany).toHaveBeenCalledWith({
      where: {
        hire_type: "new_grad",
        line_user_id: { not: null },
        tags: { some: { tag_id: "tag-1" } },
      },
      select: { id: true, last_name: true, first_name: true, line_user_id: true },
    });
  });

  it("送信に失敗した応募者はfailureCountに数える", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.findMany.mockResolvedValue([
      { id: "a1", last_name: "山田", first_name: "太郎", line_user_id: "U1" },
    ] as never);
    vi.mocked(sendTextMessage).mockRejectedValue(new Error("LINE API error"));

    const result = await sendBulkLineMessage(buildForm({ text: "hi" }));

    expect(result).toEqual({ successCount: 0, failureCount: 1, total: 1 });
    expect(prismaMock.lineMessage.create).not.toHaveBeenCalled();
  });
});
