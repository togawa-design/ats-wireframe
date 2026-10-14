import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getBroadcastHistory } from "./broadcast-history";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe("getBroadcastHistory", () => {
  it("送信日時より後にマイページへアクセスした応募者数を開封数として集計する", async () => {
    const sentAt = new Date("2026-10-01T00:00:00Z");
    prismaMock.lineBroadcast.findMany.mockResolvedValue([
      {
        id: "b1",
        sent_at: sentAt,
        template_text: "こんにちは",
        recipient_count: 3,
        sent_count: 3,
        tag: { name: "理系" },
        sender: { name: "採用太郎" },
        messages: [
          { applicant: { mypage_last_accessed_at: new Date("2026-10-02T00:00:00Z") } }, // 開封
          { applicant: { mypage_last_accessed_at: new Date("2026-09-30T00:00:00Z") } }, // 送信前アクセスのみ→未開封
          { applicant: { mypage_last_accessed_at: null } }, // 未アクセス
        ],
      },
    ] as never);

    const result = await getBroadcastHistory();

    expect(result).toEqual([
      {
        id: "b1",
        sentAt,
        templateText: "こんにちは",
        tagName: "理系",
        senderName: "採用太郎",
        recipientCount: 3,
        sentCount: 3,
        openedCount: 1,
      },
    ]);
  });

  it("タグ未指定のbroadcastはtagNameがnullになる", async () => {
    prismaMock.lineBroadcast.findMany.mockResolvedValue([
      {
        id: "b2",
        sent_at: new Date(),
        template_text: "hi",
        recipient_count: 0,
        sent_count: 0,
        tag: null,
        sender: { name: "採用太郎" },
        messages: [],
      },
    ] as never);

    const result = await getBroadcastHistory();

    expect(result[0].tagName).toBeNull();
    expect(result[0].openedCount).toBe(0);
  });
});
