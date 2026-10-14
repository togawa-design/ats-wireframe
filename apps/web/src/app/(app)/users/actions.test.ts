import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { inviteStaff, updateStaffRole, updateStaffPositionAccess, toggleStaffActive } from "./actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const admin = { id: "admin-1", role: "admin" } as never;
const recruiter = { id: "recruiter-1", role: "recruiter" } as never;

function buildForm(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

describe("inviteStaff", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(
      inviteStaff(buildForm({ name: "テスト", email: "a@example.com" }))
    ).rejects.toThrow("ログインが必要です");
  });

  it("管理者以外は例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(recruiter);
    await expect(
      inviteStaff(buildForm({ name: "テスト", email: "a@example.com" }))
    ).rejects.toThrow("この操作を行う権限がありません");
  });

  it("管理者ならplaceholder google_idでStaffを作成する(職種区分未指定ならboth)", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    await inviteStaff(buildForm({ name: "山田太郎", email: "yamada@example.com", role: "recruiter" }));

    expect(prismaMock.staff.create).toHaveBeenCalledWith({
      data: {
        name: "山田太郎",
        email: "yamada@example.com",
        role: "recruiter",
        position_type_access: "both",
        google_id: "pending:yamada@example.com",
      },
    });
  });

  it("職種区分を指定すればそれで作成する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    await inviteStaff(
      buildForm({
        name: "山田太郎",
        email: "yamada@example.com",
        role: "recruiter",
        position_type_access: "sogo",
      })
    );

    expect(prismaMock.staff.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ position_type_access: "sogo" }) })
    );
  });
});

describe("updateStaffPositionAccess", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(updateStaffPositionAccess("other-1", "sogo")).rejects.toThrow(
      "ログインが必要です"
    );
  });

  it("管理者以外は例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(recruiter);
    await expect(updateStaffPositionAccess("other-1", "sogo")).rejects.toThrow(
      "この操作を行う権限がありません"
    );
  });

  it("管理者は他のスタッフの職種区分アクセスを変更できる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    await updateStaffPositionAccess("other-1", "gino");
    expect(prismaMock.staff.update).toHaveBeenCalledWith({
      where: { id: "other-1" },
      data: { position_type_access: "gino" },
    });
  });
});

describe("updateStaffRole", () => {
  it("管理者以外は例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(recruiter);
    await expect(updateStaffRole("other-1", "admin")).rejects.toThrow(
      "この操作を行う権限がありません"
    );
  });

  it("自分自身のロールは変更できない", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    await expect(updateStaffRole("admin-1", "viewer")).rejects.toThrow(
      "自分自身のロールは変更できません"
    );
    expect(prismaMock.staff.update).not.toHaveBeenCalled();
  });

  it("管理者は他のスタッフのロールを変更できる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    await updateStaffRole("other-1", "interviewer");
    expect(prismaMock.staff.update).toHaveBeenCalledWith({
      where: { id: "other-1" },
      data: { role: "interviewer" },
    });
  });
});

describe("toggleStaffActive", () => {
  it("自分自身のアカウントは停止できない", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    await expect(toggleStaffActive("admin-1", false)).rejects.toThrow(
      "自分自身のアカウントは停止できません"
    );
  });

  it("管理者は他のスタッフを停止・再開できる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(admin);
    await toggleStaffActive("other-1", false);
    expect(prismaMock.staff.update).toHaveBeenCalledWith({
      where: { id: "other-1" },
      data: { is_active: false },
    });
  });
});
