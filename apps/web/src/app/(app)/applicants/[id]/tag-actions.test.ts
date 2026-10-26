import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { syncApplicantRichMenu } from "@/lib/line/rich-menu-sync";
import { updateApplicantTags } from "./tag-actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("@/lib/line/rich-menu-sync", () => ({
  syncApplicantRichMenu: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockStaff = { id: "staff-1", role: "admin" } as never;

function tagsForm(tagIds: string[]) {
  const form = new FormData();
  for (const id of tagIds) form.append("tag_ids", id);
  return form;
}

describe("updateApplicantTags", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(updateApplicantTags("applicant-1", tagsForm([]))).rejects.toThrow(
      "ログインが必要です"
    );
  });

  it("閲覧のみロールでは権限エラーになる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "viewer" } as never);
    await expect(updateApplicantTags("applicant-1", tagsForm([]))).rejects.toThrow(
      "この操作を行う権限がありません"
    );
  });

  it("既存タグを削除してから新しいタグを一括登録する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);

    await updateApplicantTags("applicant-1", tagsForm(["tag-1", "tag-2"]));

    expect(prismaMock.applicantTag.deleteMany).toHaveBeenCalledWith({
      where: { applicant_id: "applicant-1" },
    });
    expect(prismaMock.applicantTag.createMany).toHaveBeenCalledWith({
      data: [
        { applicant_id: "applicant-1", tag_id: "tag-1", tagged_by: "staff-1" },
        { applicant_id: "applicant-1", tag_id: "tag-2", tagged_by: "staff-1" },
      ],
    });
    expect(syncApplicantRichMenu).toHaveBeenCalledWith("applicant-1");
  });

  it("タグを全て外す場合はcreateManyを呼ばない", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    vi.mocked(prismaMock.applicantTag.createMany).mockClear();

    await updateApplicantTags("applicant-1", tagsForm([]));

    expect(prismaMock.applicantTag.deleteMany).toHaveBeenCalledWith({
      where: { applicant_id: "applicant-1" },
    });
    expect(prismaMock.applicantTag.createMany).not.toHaveBeenCalled();
    expect(syncApplicantRichMenu).toHaveBeenCalledWith("applicant-1");
  });
});
