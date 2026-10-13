import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { previewImport, importApplicants } from "./actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockStaff = { id: "staff-1", name: "テスト太郎", role: "admin" } as never;

function csvFile(content: string) {
  return new File([content], "import.csv", { type: "text/csv" });
}

describe("previewImport", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    const form = new FormData();
    form.set("file", csvFile("姓,名,メールアドレス\n山田,太郎,a@example.com"));

    await expect(previewImport("media-1", form)).rejects.toThrow("ログインが必要です");
  });

  it("ファイル未選択なら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const form = new FormData();

    await expect(previewImport("media-1", form)).rejects.toThrow("CSVファイルを選択してください");
  });

  it("保存済みマッピングが無ければヘッダーから自動検出する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.media.findUniqueOrThrow.mockResolvedValue({
      id: "media-1",
      field_mapping: {},
    } as never);
    const form = new FormData();
    form.set("file", csvFile("姓,名,メールアドレス\n山田,太郎,a@example.com"));

    const result = await previewImport("media-1", form);

    expect(result.headers).toEqual(["姓", "名", "メールアドレス"]);
    expect(result.mapping).toEqual({ last_name: "姓", first_name: "名", email: "メールアドレス" });
    expect(result.rowCount).toBe(1);
  });

  it("保存済みマッピングがあれば自動検出より優先する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.media.findUniqueOrThrow.mockResolvedValue({
      id: "media-1",
      field_mapping: { last_name: "LastName", email: "メールアドレス" },
    } as never);
    const form = new FormData();
    form.set("file", csvFile("姓,LastName,メールアドレス\n太郎,山田,a@example.com"));

    const result = await previewImport("media-1", form);

    expect(result.mapping.last_name).toBe("LastName");
    expect(result.mapping.email).toBe("メールアドレス");
  });

  it("保存済みマッピングの列が今回のCSVに存在しなければ無視する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.media.findUniqueOrThrow.mockResolvedValue({
      id: "media-1",
      field_mapping: { last_name: "存在しない列" },
    } as never);
    const form = new FormData();
    form.set("file", csvFile("姓,名,メールアドレス\n山田,太郎,a@example.com"));

    const result = await previewImport("media-1", form);

    expect(result.mapping.last_name).toBe("姓");
  });
});

describe("importApplicants", () => {
  const mapping = { last_name: "姓", first_name: "名", email: "メールアドレス" };

  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(importApplicants("media-1", "姓,名,メールアドレス\n山田,太郎,a@example.com", mapping)).rejects.toThrow(
      "ログインが必要です"
    );
  });

  it("必須項目(姓・名・メール)がマッピングされていなければ例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await expect(
      importApplicants("media-1", "姓,名\n山田,太郎", { last_name: "姓" })
    ).rejects.toThrow("姓・名・メールアドレスのマッピングは必須です");
  });

  it("新規応募者を作成し、流入元とデフォルトSelectionも紐付ける", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.school.findMany.mockResolvedValue([]);
    prismaMock.applicant.findFirst.mockResolvedValue(null);
    prismaMock.applicant.create.mockResolvedValue({ id: "applicant-1" } as never);
    prismaMock.selectionFlow.findFirst.mockResolvedValue({
      id: "flow-1",
      stages: [{ id: "stage-1" }],
    } as never);

    const result = await importApplicants(
      "media-1",
      "姓,名,メールアドレス\n山田,太郎,a@example.com",
      mapping
    );

    expect(result).toEqual({ created: 1, skipped: 0, total: 1 });
    expect(prismaMock.applicant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ last_name: "山田", first_name: "太郎", email: "a@example.com" }),
    });
    expect(prismaMock.applicantSource.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ applicant_id: "applicant-1", media_id: "media-1" }),
    });
    expect(prismaMock.selection.create).toHaveBeenCalledWith({
      data: { applicant_id: "applicant-1", flow_id: "flow-1", current_stage_id: "stage-1" },
    });
    expect(prismaMock.media.update).toHaveBeenCalledWith({
      where: { id: "media-1" },
      data: { field_mapping: mapping },
    });
  });

  it("同じメールアドレスの既存応募者がいればスキップする", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.school.findMany.mockResolvedValue([]);
    prismaMock.applicant.findFirst.mockResolvedValue({ id: "existing-1" } as never);

    const result = await importApplicants(
      "media-1",
      "姓,名,メールアドレス\n山田,太郎,a@example.com",
      mapping
    );

    expect(result).toEqual({ created: 0, skipped: 1, total: 1 });
    expect(prismaMock.applicant.create).not.toHaveBeenCalled();
  });

  it("必須項目が空の行はスキップする", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.school.findMany.mockResolvedValue([]);

    const result = await importApplicants(
      "media-1",
      "姓,名,メールアドレス\n,太郎,a@example.com",
      mapping
    );

    expect(result).toEqual({ created: 0, skipped: 1, total: 1 });
    expect(prismaMock.applicant.findFirst).not.toHaveBeenCalled();
  });
});
