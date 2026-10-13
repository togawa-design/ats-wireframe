import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getFunnelData,
  getMediaBreakdown,
  getSchoolBreakdown,
  getOfferAndAcceptanceSelections,
} from "./analytics";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe("getFunnelData", () => {
  it("デフォルトフローが無ければ空配列を返す", async () => {
    prismaMock.selectionFlow.findFirst.mockResolvedValue(null);
    expect(await getFunnelData()).toEqual([]);
  });

  it("各ステージについて到達済み人数(バイパスカウント)と前段階からの転換率を計算する", async () => {
    prismaMock.selectionFlow.findFirst.mockResolvedValue({
      stages: [
        { id: "s1", name: "エントリー", order: 1 },
        { id: "s2", name: "書類選考", order: 2 },
        { id: "s3", name: "1次面接", order: 3 },
      ],
    } as never);
    // 4人がエントリー到達、2人が書類選考到達、1人が1次面接到達
    prismaMock.selection.findMany.mockResolvedValue([
      { current_stage: { order: 1 } },
      { current_stage: { order: 1 } },
      { current_stage: { order: 2 } },
      { current_stage: { order: 3 } },
    ] as never);

    const result = await getFunnelData();

    expect(result).toEqual([
      { stageId: "s1", stageName: "エントリー", count: 4, conversionFromPrev: null },
      { stageId: "s2", stageName: "書類選考", count: 2, conversionFromPrev: 50 },
      { stageId: "s3", stageName: "1次面接", count: 1, conversionFromPrev: 50 },
    ]);
  });

  it("前段階の人数が0なら転換率はnull", async () => {
    prismaMock.selectionFlow.findFirst.mockResolvedValue({
      stages: [
        { id: "s1", name: "エントリー", order: 1 },
        { id: "s2", name: "書類選考", order: 2 },
      ],
    } as never);
    prismaMock.selection.findMany.mockResolvedValue([] as never);

    const result = await getFunnelData();
    expect(result[1].conversionFromPrev).toBeNull();
  });
});

describe("getMediaBreakdown", () => {
  it("媒体ごとの流入数を集計する(流入0件の媒体も含む)", async () => {
    prismaMock.media.findMany.mockResolvedValue([
      { id: "m1", name: "マイナビ" },
      { id: "m2", name: "OfferBox" },
    ] as never);
    // groupByはオーバーロードが多くvitest-mock-extendedの型推論が効かないため、
    // Mock型にキャストしてmockResolvedValueを呼ぶ。
    (prismaMock.applicantSource.groupBy as unknown as Mock).mockResolvedValue([
      { media_id: "m1", _count: { _all: 5 } },
    ]);

    const result = await getMediaBreakdown();

    expect(result).toEqual([
      { name: "マイナビ", count: 5 },
      { name: "OfferBox", count: 0 },
    ]);
  });
});

describe("getSchoolBreakdown", () => {
  it("学校が1つも登録されていなければ空配列を返す", async () => {
    (prismaMock.applicant.groupBy as unknown as Mock).mockResolvedValue([]);
    expect(await getSchoolBreakdown()).toEqual([]);
    expect(prismaMock.school.findMany).not.toHaveBeenCalled();
  });

  it("学校別の人数を多い順に並べる", async () => {
    (prismaMock.applicant.groupBy as unknown as Mock).mockResolvedValue([
      { school_id: "sc1", _count: { _all: 2 } },
      { school_id: "sc2", _count: { _all: 5 } },
    ]);
    prismaMock.school.findMany.mockResolvedValue([
      { id: "sc1", name: "A大学" },
      { id: "sc2", name: "B大学" },
    ] as never);

    const result = await getSchoolBreakdown();

    expect(result).toEqual([
      { name: "B大学", count: 5 },
      { name: "A大学", count: 2 },
    ]);
  });
});

describe("getOfferAndAcceptanceSelections", () => {
  it("現在のステージがoffer/acceptanceのSelectionのみ取得する", async () => {
    prismaMock.selection.findMany.mockResolvedValue([{ id: "sel-1" }] as never);

    await getOfferAndAcceptanceSelections();

    expect(prismaMock.selection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { current_stage: { stage_type: { in: ["offer", "acceptance"] } } },
      })
    );
  });
});
