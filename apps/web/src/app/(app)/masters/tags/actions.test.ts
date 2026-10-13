import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { createTag, deleteTag } from "./actions";

// vi.mock はテストファイルごとに宣言する。setupFiles側での登録はそのファイルが
// 静的importするモジュールグラフの解決タイミングに間に合わないため使えない。
vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockStaff = { id: "staff-1", name: "テスト太郎", role: "admin" } as never;

describe("createTag", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    const form = new FormData();
    form.set("name", "理系");

    await expect(createTag(form)).rejects.toThrow("ログインが必要です");
    expect(prismaMock.tag.create).not.toHaveBeenCalled();
  });

  it("閲覧のみロールでは権限エラーになる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "viewer" } as never);
    const form = new FormData();
    form.set("name", "理系");

    await expect(createTag(form)).rejects.toThrow("この操作を行う権限がありません");
    expect(prismaMock.tag.create).not.toHaveBeenCalled();
  });

  it("タグ名が空なら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const form = new FormData();
    form.set("name", "   ");

    await expect(createTag(form)).rejects.toThrow("タグ名を入力してください");
    expect(prismaMock.tag.create).not.toHaveBeenCalled();
  });

  it("有効な入力でタグを作成する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const form = new FormData();
    form.set("name", "理系");
    form.set("color", "#2E6480");

    await createTag(form);

    expect(prismaMock.tag.create).toHaveBeenCalledWith({
      data: { name: "理系", color: "#2E6480", created_by: "staff-1" },
    });
  });
});

describe("deleteTag", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(deleteTag("tag-1")).rejects.toThrow("ログインが必要です");
    expect(prismaMock.tag.delete).not.toHaveBeenCalled();
  });

  it("ログイン済みなら指定IDのタグを削除する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await deleteTag("tag-1");
    expect(prismaMock.tag.delete).toHaveBeenCalledWith({ where: { id: "tag-1" } });
  });
});
