import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { createQRCode, deleteQRCode } from "./actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockStaff = { id: "staff-1", name: "テスト太郎", role: "admin" } as never;

function buildForm(fields: Record<string, string | string[]>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      value.forEach((v) => form.append(key, v));
    } else {
      form.set(key, value);
    }
  }
  return form;
}

describe("createQRCode", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    const form = buildForm({ label: "学校説明会A", liff_url: "https://example.com" });

    await expect(createQRCode(form)).rejects.toThrow("ログインが必要です");
    expect(prismaMock.qRCode.create).not.toHaveBeenCalled();
  });

  it("閲覧のみロールでは権限エラーになる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "viewer" } as never);
    const form = buildForm({ label: "学校説明会A", liff_url: "https://example.com" });

    await expect(createQRCode(form)).rejects.toThrow("この操作を行う権限がありません");
  });

  it("ラベルが空なら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const form = buildForm({ label: "", liff_url: "https://example.com" });

    await expect(createQRCode(form)).rejects.toThrow("ラベルを入力してください");
  });

  it("遷移先URLが空なら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const form = buildForm({ label: "学校説明会A", liff_url: "" });

    await expect(createQRCode(form)).rejects.toThrow("遷移先URLを入力してください");
  });

  it("有効な入力でQRコードを作成し、自動付与タグも保存する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const form = buildForm({
      label: "学校説明会A",
      liff_url: "https://example.com/line",
      auto_tags: ["tag-1", "tag-2"],
    });

    await createQRCode(form);

    expect(prismaMock.qRCode.create).toHaveBeenCalledWith({
      data: {
        label: "学校説明会A",
        liff_url: "https://example.com/line",
        auto_tags: ["tag-1", "tag-2"],
        scan_count: 0,
      },
    });
  });
});

describe("deleteQRCode", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(deleteQRCode("qr-1")).rejects.toThrow("ログインが必要です");
    expect(prismaMock.qRCode.delete).not.toHaveBeenCalled();
  });

  it("ログイン済みなら指定IDのQRコードを削除する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await deleteQRCode("qr-1");
    expect(prismaMock.qRCode.delete).toHaveBeenCalledWith({ where: { id: "qr-1" } });
  });
});
