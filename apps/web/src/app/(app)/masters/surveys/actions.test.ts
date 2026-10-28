import { describe, expect, it, vi, beforeEach } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { sendTextMessage } from "@/lib/line/client";
import { recordAuditLog } from "@/lib/audit-log";
import {
  createSurvey,
  deleteSurvey,
  publishSurvey,
  unpublishSurvey,
  sendSurvey,
  remindSurvey,
} from "./actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("@/lib/line/client", () => ({
  sendTextMessage: vi.fn(),
  describeLineSendError: vi.fn((e: unknown) => (e instanceof Error ? e.message : "LINE送信に失敗しました")),
}));
vi.mock("@/lib/audit-log", () => ({
  recordAuditLog: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockStaff = { id: "staff-1", role: "admin" } as never;

function questionForm(fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

beforeEach(() => {
  vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
  process.env.NEXT_PUBLIC_SURVEY_LIFF_ID = "liff-123";
});

describe("createSurvey", () => {
  it("タイトルが無ければエラーになる", async () => {
    const result = await createSurvey(
      questionForm({ title: "", question_count: "1", question_type_0: "text", question_label_0: "質問1" })
    );
    expect(result).toEqual({ ok: false, error: "タイトルを入力してください" });
  });

  it("質問が0件だとエラーになる", async () => {
    const result = await createSurvey(questionForm({ title: "満足度調査", question_count: "0" }));
    expect(result).toEqual({ ok: false, error: "質問を1つ以上追加してください" });
  });

  it("選択式の質問で選択肢が1つ以下だとエラーになる", async () => {
    const result = await createSurvey(
      questionForm({
        title: "満足度調査",
        question_count: "1",
        question_type_0: "single_choice",
        question_label_0: "満足度は?",
        question_options_0: "満足",
      })
    );
    expect(result).toEqual({ ok: false, error: "質問1の選択肢を2つ以上入力してください" });
  });

  it("正しい入力で作成できる", async () => {
    const result = await createSurvey(
      questionForm({
        title: "満足度調査",
        description: "説明文",
        question_count: "2",
        question_type_0: "text",
        question_label_0: "感想を教えてください",
        question_type_1: "single_choice",
        question_label_1: "満足度は?",
        question_options_1: "満足\n不満",
      })
    );
    expect(result).toEqual({ ok: true });
    expect(prismaMock.survey.create).toHaveBeenCalledWith({
      data: {
        title: "満足度調査",
        description: "説明文",
        questions: [
          { id: "q1", type: "text", label: "感想を教えてください" },
          { id: "q2", type: "single_choice", label: "満足度は?", options: ["満足", "不満"] },
        ],
        status: "draft",
      },
    });
  });
});

describe("deleteSurvey", () => {
  it("削除する", async () => {
    await deleteSurvey("survey-1");
    expect(prismaMock.survey.delete).toHaveBeenCalledWith({ where: { id: "survey-1" } });
  });
});

describe("publishSurvey", () => {
  it("公開状態にする", async () => {
    const result = await publishSurvey("survey-1");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.survey.update).toHaveBeenCalledWith({
      where: { id: "survey-1" },
      data: { status: "published" },
    });
  });
});

describe("unpublishSurvey", () => {
  it("送信済みの相手がいる場合は下書きに戻せない", async () => {
    prismaMock.surveyRecipient.count.mockResolvedValue(3);
    const result = await unpublishSurvey("survey-1");
    expect(result).toEqual({ ok: false, error: "送信済みのため下書きには戻せません" });
    expect(prismaMock.survey.update).not.toHaveBeenCalled();
  });

  it("送信済みの相手がいなければ下書きに戻せる", async () => {
    prismaMock.surveyRecipient.count.mockResolvedValue(0);
    const result = await unpublishSurvey("survey-1");
    expect(result).toEqual({ ok: true });
    expect(prismaMock.survey.update).toHaveBeenCalledWith({
      where: { id: "survey-1" },
      data: { status: "draft" },
    });
  });
});

describe("sendSurvey", () => {
  it("アンケートが見つからなければエラー", async () => {
    prismaMock.survey.findUnique.mockResolvedValue(null);
    const result = await sendSurvey("survey-1", new FormData());
    expect(result).toEqual({ ok: false, error: "アンケートが見つかりません" });
  });

  it("下書きの場合はエラー", async () => {
    prismaMock.survey.findUnique.mockResolvedValue({ status: "draft" } as never);
    const result = await sendSurvey("survey-1", new FormData());
    expect(result).toEqual({ ok: false, error: "公開してから送信してください" });
  });

  it("LIFF IDが未設定の場合はエラー", async () => {
    delete process.env.NEXT_PUBLIC_SURVEY_LIFF_ID;
    prismaMock.survey.findUnique.mockResolvedValue({ status: "published", title: "t" } as never);
    const result = await sendSurvey("survey-1", new FormData());
    expect(result).toEqual({ ok: false, error: "NEXT_PUBLIC_SURVEY_LIFF_ID が設定されていません" });
  });

  it("未送信の対象者に送信し、SurveyRecipientを作成する", async () => {
    prismaMock.survey.findUnique.mockResolvedValue({
      id: "survey-1",
      status: "published",
      title: "満足度調査",
    } as never);
    prismaMock.applicant.findMany.mockResolvedValue([
      { id: "applicant-1", line_user_id: "U1" },
      { id: "applicant-2", line_user_id: "U2" },
    ] as never);
    vi.mocked(sendTextMessage).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("fail"));

    const result = await sendSurvey("survey-1", new FormData());

    expect(prismaMock.applicant.findMany).toHaveBeenCalledWith({
      where: {
        hire_type: "new_grad",
        line_user_id: { not: null },
        survey_recipients: { none: { survey_id: "survey-1" } },
      },
      select: { id: true, line_user_id: true },
    });
    expect(sendTextMessage).toHaveBeenCalledTimes(2);
    expect(prismaMock.surveyRecipient.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.surveyRecipient.create).toHaveBeenCalledWith({
      data: { survey_id: "survey-1", applicant_id: "applicant-1" },
    });
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: "staff-1", action: "line_send", targetId: "survey-1" })
    );
    expect(result).toEqual({ ok: true, successCount: 1, failureCount: 1, total: 2 });
  });
});

describe("remindSurvey", () => {
  it("未回答者だけにリマインドを送る", async () => {
    prismaMock.survey.findUnique.mockResolvedValue({ id: "survey-1", title: "満足度調査" } as never);
    prismaMock.surveyRecipient.findMany.mockResolvedValue([
      { id: "rec-1", applicant: { id: "applicant-1", line_user_id: "U1" } },
    ] as never);

    const result = await remindSurvey("survey-1");

    expect(prismaMock.surveyRecipient.findMany).toHaveBeenCalledWith({
      where: {
        survey_id: "survey-1",
        applicant: { survey_responses: { none: { survey_id: "survey-1" } } },
      },
      include: { applicant: { select: { id: true, line_user_id: true } } },
    });
    expect(sendTextMessage).toHaveBeenCalledWith("U1", expect.stringContaining("リマインド"));
    expect(prismaMock.surveyRecipient.update).toHaveBeenCalledWith({
      where: { id: "rec-1" },
      data: { reminded_at: expect.any(Date) },
    });
    expect(result).toEqual({ ok: true, successCount: 1, failureCount: 0, total: 1 });
  });
});
