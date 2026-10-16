import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getFunnelData,
  getMediaBreakdown,
  getQrCodeBreakdown,
  getSchoolBreakdown,
  getOfferAndAcceptanceSelections,
  getAllApplicantsForExport,
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

function sourceWithStage(stageType: string | null) {
  return {
    applicant: {
      selection: stageType ? { current_stage: { stage_type: stageType } } : null,
    },
  };
}

describe("getMediaBreakdown", () => {
  it("媒体ごとの流入数・承諾率を集計する(流入0件の媒体も含み、ドリルダウン用にidも返す)", async () => {
    prismaMock.media.findMany.mockResolvedValue([
      { id: "m1", name: "マイナビ" },
      { id: "m2", name: "OfferBox" },
    ] as never);
    prismaMock.applicantSource.findMany.mockResolvedValue([
      { media_id: "m1", ...sourceWithStage("acceptance") },
      { media_id: "m1", ...sourceWithStage("screening") },
      { media_id: "m1", ...sourceWithStage(null) },
      { media_id: "m1", ...sourceWithStage(null) },
      { media_id: "m1", ...sourceWithStage(null) },
    ] as never);

    const result = await getMediaBreakdown();

    expect(result).toEqual([
      { id: "m1", name: "マイナビ", count: 5, acceptanceRate: 20 },
      { id: "m2", name: "OfferBox", count: 0, acceptanceRate: null },
    ]);
  });
});

describe("getQrCodeBreakdown", () => {
  it("流入が1件も無いQRコードは除外する", async () => {
    prismaMock.qRCode.findMany.mockResolvedValue([
      { id: "qr1", label: "説明会チラシ", scan_count: 10 },
    ] as never);
    prismaMock.applicantSource.findMany.mockResolvedValue([] as never);

    expect(await getQrCodeBreakdown()).toEqual([]);
  });

  it("QRコードごとの流入数・承諾率を流入数の多い順に並べる", async () => {
    prismaMock.qRCode.findMany.mockResolvedValue([
      { id: "qr1", label: "説明会チラシ", scan_count: 10 },
      { id: "qr2", label: "求人サイト掲載", scan_count: 20 },
    ] as never);
    prismaMock.applicantSource.findMany.mockResolvedValue([
      { qr_code_id: "qr1", ...sourceWithStage("acceptance") },
      { qr_code_id: "qr2", ...sourceWithStage("acceptance") },
      { qr_code_id: "qr2", ...sourceWithStage(null) },
      { qr_code_id: "qr2", ...sourceWithStage(null) },
    ] as never);

    const result = await getQrCodeBreakdown();

    expect(result).toEqual([
      { id: "qr2", label: "求人サイト掲載", scanCount: 20, entryCount: 3, acceptanceRate: 33.3 },
      { id: "qr1", label: "説明会チラシ", scanCount: 10, entryCount: 1, acceptanceRate: 100 },
    ]);
  });
});

describe("getSchoolBreakdown", () => {
  it("学校が1つも登録されていなければ空配列を返す", async () => {
    (prismaMock.applicant.groupBy as unknown as Mock).mockResolvedValue([]);
    expect(await getSchoolBreakdown()).toEqual([]);
    expect(prismaMock.school.findMany).not.toHaveBeenCalled();
  });

  it("学校別の人数を多い順に並べる(ドリルダウン用にidも返す)", async () => {
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
      { id: "sc2", name: "B大学", count: 5 },
      { id: "sc1", name: "A大学", count: 2 },
    ]);
  });
});

describe("getOfferAndAcceptanceSelections", () => {
  it("現在のステージがoffer/acceptanceのSelectionのみ取得する", async () => {
    prismaMock.selection.findMany.mockResolvedValue([{ id: "sel-1" }] as never);

    await getOfferAndAcceptanceSelections();

    expect(prismaMock.selection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          current_stage: { stage_type: { in: ["offer", "acceptance"] } },
          applicant: {},
        },
      })
    );
  });

  it("職種区分が指定されていれば応募者をその区分(と未設定)に絞り込む(FR095)", async () => {
    prismaMock.selection.findMany.mockResolvedValue([] as never);

    await getOfferAndAcceptanceSelections({ positionType: "sogo" });

    expect(prismaMock.selection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          applicant: { OR: [{ position_type: "sogo" }, { position_type: null }] },
        }),
      })
    );
  });
});

describe("FR095: 職種区分によるアクセス制限", () => {
  it("getFunnelDataは指定した職種区分でSelectionを絞り込む", async () => {
    prismaMock.selectionFlow.findFirst.mockResolvedValue({ stages: [] } as never);
    prismaMock.selection.findMany.mockResolvedValue([] as never);

    await getFunnelData({ positionType: "gino" });

    expect(prismaMock.selection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicant: { OR: [{ position_type: "gino" }, { position_type: null }] } },
      })
    );
  });

  it("getMediaBreakdownは指定した職種区分でApplicantSourceを絞り込む", async () => {
    prismaMock.media.findMany.mockResolvedValue([] as never);
    prismaMock.applicantSource.findMany.mockResolvedValue([] as never);

    await getMediaBreakdown({ positionType: "sogo" });

    expect(prismaMock.applicantSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          media_id: { not: null },
          applicant: { OR: [{ position_type: "sogo" }, { position_type: null }] },
        },
      })
    );
  });

  it("getSchoolBreakdownは指定した職種区分でApplicantを絞り込む", async () => {
    (prismaMock.applicant.groupBy as unknown as Mock).mockResolvedValue([]);

    await getSchoolBreakdown({ positionType: "gino" });

    expect(prismaMock.applicant.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          school_id: { not: null },
          OR: [{ position_type: "gino" }, { position_type: null }],
        },
      })
    );
  });

  it("getAllApplicantsForExportは指定した職種区分でApplicantを絞り込む", async () => {
    prismaMock.applicant.findMany.mockResolvedValue([] as never);

    await getAllApplicantsForExport("sogo");

    expect(prismaMock.applicant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ position_type: "sogo" }, { position_type: null }] },
      })
    );
  });

  it("職種区分未指定(null)ならどの関数も絞り込み無し({})になる", async () => {
    prismaMock.applicant.findMany.mockResolvedValue([] as never);
    await getAllApplicantsForExport();
    expect(prismaMock.applicant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });
});

describe("FR103: 集計期間による絞り込み", () => {
  it("getFunnelDataはfrom/toを応募者のcreated_atの範囲条件に変換する", async () => {
    prismaMock.selectionFlow.findFirst.mockResolvedValue({ stages: [] } as never);
    prismaMock.selection.findMany.mockResolvedValue([] as never);
    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-03-31T23:59:59Z");

    await getFunnelData({ from, to });

    expect(prismaMock.selection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicant: { created_at: { gte: from, lte: to } } },
      })
    );
  });

  it("fromのみ指定すればgteのみになる", async () => {
    prismaMock.selectionFlow.findFirst.mockResolvedValue({ stages: [] } as never);
    prismaMock.selection.findMany.mockResolvedValue([] as never);
    const from = new Date("2026-01-01T00:00:00Z");

    await getFunnelData({ from });

    expect(prismaMock.selection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicant: { created_at: { gte: from } } },
      })
    );
  });

  it("職種区分と集計期間を両方指定すれば両方の条件が付く", async () => {
    (prismaMock.applicant.groupBy as unknown as Mock).mockResolvedValue([]);
    const to = new Date("2026-03-31T23:59:59Z");

    await getSchoolBreakdown({ positionType: "sogo", to });

    expect(prismaMock.applicant.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          school_id: { not: null },
          OR: [{ position_type: "sogo" }, { position_type: null }],
          created_at: { lte: to },
        },
      })
    );
  });

  it("getAllApplicantsForExportは集計期間を考慮しない(全件対象のエクスポートのため)", async () => {
    prismaMock.applicant.findMany.mockResolvedValue([] as never);
    await getAllApplicantsForExport("gino");
    expect(prismaMock.applicant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ position_type: "gino" }, { position_type: null }] },
      })
    );
  });
});
