import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { linkRichMenuToUser } from "./client";
import { syncApplicantRichMenu } from "./rich-menu-sync";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("./client", () => ({
  linkRichMenuToUser: vi.fn(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe("syncApplicantRichMenu", () => {
  it("LINE未連携の応募者には何もしない", async () => {
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: null,
      tags: [],
    } as never);

    await syncApplicantRichMenu("applicant-1");

    expect(prismaMock.richMenu.findFirst).not.toHaveBeenCalled();
    expect(linkRichMenuToUser).not.toHaveBeenCalled();
  });

  it("タグが無い応募者には何もしない(LINE側の既定メニューのまま)", async () => {
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: "U123",
      tags: [],
    } as never);

    await syncApplicantRichMenu("applicant-1");

    expect(prismaMock.richMenu.findFirst).not.toHaveBeenCalled();
    expect(linkRichMenuToUser).not.toHaveBeenCalled();
  });

  it("一致する公開中メニューが無ければ何もしない", async () => {
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: "U123",
      tags: [{ tag_id: "tag-1" }],
    } as never);
    prismaMock.richMenu.findFirst.mockResolvedValue(null);

    await syncApplicantRichMenu("applicant-1");

    expect(linkRichMenuToUser).not.toHaveBeenCalled();
  });

  it("タグに一致する優先度最大のメニューをLINE側に紐付ける", async () => {
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: "U123",
      tags: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }],
    } as never);
    prismaMock.richMenu.findFirst.mockResolvedValue({
      line_rich_menu_id: "line-rm-1",
    } as never);

    await syncApplicantRichMenu("applicant-1");

    expect(prismaMock.richMenu.findFirst).toHaveBeenCalledWith({
      where: {
        status: "published",
        line_rich_menu_id: { not: null },
        rules: { some: { tag_id: { in: ["tag-1", "tag-2"] } } },
      },
      orderBy: { priority: "desc" },
    });
    expect(linkRichMenuToUser).toHaveBeenCalledWith("U123", "line-rm-1");
  });

  it("LINE API呼び出しが失敗しても例外を投げない", async () => {
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: "U123",
      tags: [{ tag_id: "tag-1" }],
    } as never);
    prismaMock.richMenu.findFirst.mockResolvedValue({
      line_rich_menu_id: "line-rm-1",
    } as never);
    vi.mocked(linkRichMenuToUser).mockRejectedValue(new Error("LINE down"));

    await expect(syncApplicantRichMenu("applicant-1")).resolves.toBeUndefined();
  });
});
