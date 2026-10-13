import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { createApplicant, deleteApplicant, issueLineRegistrationToken } from "./actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockStaff = { id: "staff-1", name: "テスト太郎" } as never;

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

describe("createApplicant", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    const form = buildForm({ last_name: "山田", first_name: "太郎", email: "a@example.com" });

    await expect(createApplicant(form)).rejects.toThrow("ログインが必要です");
    expect(prismaMock.applicant.create).not.toHaveBeenCalled();
  });

  it("氏名が空なら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const form = buildForm({ last_name: "", first_name: "", email: "a@example.com" });

    await expect(createApplicant(form)).rejects.toThrow("氏名を入力してください");
  });

  it("メールアドレスが空なら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const form = buildForm({ last_name: "山田", first_name: "太郎", email: "" });

    await expect(createApplicant(form)).rejects.toThrow("メールアドレスを入力してください");
  });

  it("有効な入力で応募者を作成し、タグも紐付ける", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.create.mockResolvedValue({ id: "applicant-1" } as never);
    const form = buildForm({
      last_name: "山田",
      first_name: "太郎",
      email: "a@example.com",
      school_id: "school-1",
      graduation_year: "2027",
      applicant_type: "new_grad",
      hire_type: "new_grad",
      position_type: "sogo",
      tag_ids: ["tag-1", "tag-2"],
    });

    await createApplicant(form);

    expect(prismaMock.applicant.create).toHaveBeenCalledWith({
      data: {
        last_name: "山田",
        first_name: "太郎",
        email: "a@example.com",
        school_id: "school-1",
        graduation_year: 2027,
        applicant_type: "new_grad",
        hire_type: "new_grad",
        position_type: "sogo",
      },
    });
    expect(prismaMock.applicantTag.createMany).toHaveBeenCalledWith({
      data: [
        { applicant_id: "applicant-1", tag_id: "tag-1", tagged_by: "staff-1" },
        { applicant_id: "applicant-1", tag_id: "tag-2", tagged_by: "staff-1" },
      ],
    });
  });
});

describe("createApplicant (Selection自動作成)", () => {
  it("デフォルト選考フローがあれば、その最初のステージでSelectionを作成する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.create.mockResolvedValue({ id: "applicant-1" } as never);
    prismaMock.selectionFlow.findFirst.mockResolvedValue({
      id: "flow-1",
      stages: [{ id: "stage-1" }],
    } as never);
    const form = buildForm({ last_name: "山田", first_name: "太郎", email: "a@example.com" });

    await createApplicant(form);

    expect(prismaMock.selection.create).toHaveBeenCalledWith({
      data: { applicant_id: "applicant-1", flow_id: "flow-1", current_stage_id: "stage-1" },
    });
  });

  it("デフォルト選考フローがなければSelectionを作成しない", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.create.mockResolvedValue({ id: "applicant-1" } as never);
    prismaMock.selectionFlow.findFirst.mockResolvedValue(null);
    const form = buildForm({ last_name: "山田", first_name: "太郎", email: "a@example.com" });

    await createApplicant(form);

    expect(prismaMock.selection.create).not.toHaveBeenCalled();
  });
});

describe("deleteApplicant", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(deleteApplicant("applicant-1")).rejects.toThrow("ログインが必要です");
    expect(prismaMock.applicant.delete).not.toHaveBeenCalled();
  });

  it("ログイン済みなら指定IDの応募者を削除する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await deleteApplicant("applicant-1");
    expect(prismaMock.applicant.delete).toHaveBeenCalledWith({ where: { id: "applicant-1" } });
  });
});

describe("issueLineRegistrationToken", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(issueLineRegistrationToken("applicant-1")).rejects.toThrow(
      "ログインが必要です"
    );
    expect(prismaMock.lineRegistrationToken.create).not.toHaveBeenCalled();
  });

  it("ログイン済みなら64文字のトークンと24時間後の有効期限で作成する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const before = Date.now();

    await issueLineRegistrationToken("applicant-1");

    expect(prismaMock.lineRegistrationToken.create).toHaveBeenCalledTimes(1);
    const callArg = prismaMock.lineRegistrationToken.create.mock.calls[0][0].data;
    expect(callArg.applicant_id).toBe("applicant-1");
    expect(callArg.token).toMatch(/^[0-9a-f]{64}$/);
    expect((callArg.expires_at as Date).getTime()).toBeGreaterThan(
      before + 23 * 60 * 60 * 1000
    );
  });
});
