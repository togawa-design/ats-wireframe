import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { sendTextMessage, sendImageMessage } from "@/lib/line/client";
import { uploadLineMessageImage } from "@/lib/firebase/storage";
import { sendApplicantLineMessage } from "./line-actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("@/lib/line/client", () => ({
  sendTextMessage: vi.fn(),
  sendImageMessage: vi.fn(),
  describeLineSendError: vi.fn((e: unknown) => (e instanceof Error ? e.message : "LINE送信に失敗しました")),
}));
vi.mock("@/lib/firebase/storage", () => ({
  uploadLineMessageImage: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockStaff = { id: "staff-1", role: "admin" } as never;

function textForm(text: string) {
  const form = new FormData();
  form.set("text", text);
  return form;
}

function imageForm(file: File) {
  const form = new FormData();
  form.set("file", file);
  return form;
}

function jpgFile(size = 100) {
  return new File([new Uint8Array(size)], "photo.jpg", { type: "image/jpeg" });
}

describe("sendApplicantLineMessage", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(sendApplicantLineMessage("applicant-1", textForm("hi"))).rejects.toThrow(
      "ログインが必要です"
    );
  });

  it("閲覧のみロールでは権限エラーになる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "viewer" } as never);
    await expect(sendApplicantLineMessage("applicant-1", textForm("hi"))).rejects.toThrow(
      "この操作を行う権限がありません"
    );
  });

  it("応募者が存在しなければ例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.findUnique.mockResolvedValue(null);
    await expect(sendApplicantLineMessage("applicant-1", textForm("hi"))).rejects.toThrow(
      "応募者が見つかりません"
    );
  });

  it("中途応募者なら失敗結果を返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: "U1",
      hire_type: "mid_career",
    } as never);
    await expect(sendApplicantLineMessage("applicant-1", textForm("hi"))).resolves.toEqual({
      ok: false,
      error: "中途応募者はLINE機能の対象外です",
    });
  });

  it("LINE未連携なら失敗結果を返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: null,
      hire_type: "new_grad",
    } as never);
    await expect(sendApplicantLineMessage("applicant-1", textForm("hi"))).resolves.toEqual({
      ok: false,
      error: "LINE未連携の応募者です",
    });
  });

  it("テキストも画像も無ければ失敗結果を返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: "U1",
      hire_type: "new_grad",
    } as never);
    await expect(sendApplicantLineMessage("applicant-1", textForm(""))).resolves.toEqual({
      ok: false,
      error: "メッセージを入力するか、画像を選択してください",
    });
  });

  it("テキスト送信に成功すればoutboundのLineMessageを記録する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: "U1",
      hire_type: "new_grad",
    } as never);

    const result = await sendApplicantLineMessage("applicant-1", textForm("こんにちは"));

    expect(result).toEqual({ ok: true });
    expect(sendTextMessage).toHaveBeenCalledWith("U1", "こんにちは");
    expect(prismaMock.lineMessage.create).toHaveBeenCalledWith({
      data: {
        applicant_id: "applicant-1",
        direction: "outbound",
        message_type: "text",
        content: "こんにちは",
      },
    });
  });

  it("テキスト送信がLINE側のエラーで失敗したら、安全なメッセージに変換した失敗結果を返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: "U1",
      hire_type: "new_grad",
    } as never);
    vi.mocked(sendTextMessage).mockRejectedValue(new Error("400 - Bad Request"));

    await expect(sendApplicantLineMessage("applicant-1", textForm("こんにちは"))).resolves.toEqual({
      ok: false,
      error: "400 - Bad Request",
    });
    expect(prismaMock.lineMessage.create).not.toHaveBeenCalled();
  });

  it("10MBを超える画像は失敗結果を返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: "U1",
      hire_type: "new_grad",
    } as never);

    await expect(
      sendApplicantLineMessage("applicant-1", imageForm(jpgFile(10 * 1024 * 1024 + 1)))
    ).resolves.toEqual({ ok: false, error: "画像サイズは10MB以下にしてください" });
  });

  it("JPG以外の画像は失敗結果を返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: "U1",
      hire_type: "new_grad",
    } as never);
    const pngFile = new File([new Uint8Array(10)], "photo.png", { type: "image/png" });

    await expect(sendApplicantLineMessage("applicant-1", imageForm(pngFile))).resolves.toEqual({
      ok: false,
      error: "JPG画像を選択してください",
    });
  });

  it("画像送信に成功すればアップロードしoutboundのLineMessageを記録する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.applicant.findUnique.mockResolvedValue({
      line_user_id: "U1",
      hire_type: "new_grad",
    } as never);
    vi.mocked(uploadLineMessageImage).mockResolvedValue("https://storage.example.com/a.jpg");

    const result = await sendApplicantLineMessage("applicant-1", imageForm(jpgFile()));

    expect(result).toEqual({ ok: true });
    expect(uploadLineMessageImage).toHaveBeenCalledWith(
      "applicant-1",
      expect.any(Buffer),
      "image/jpeg"
    );
    expect(sendImageMessage).toHaveBeenCalledWith("U1", "https://storage.example.com/a.jpg");
    expect(prismaMock.lineMessage.create).toHaveBeenCalledWith({
      data: {
        applicant_id: "applicant-1",
        direction: "outbound",
        message_type: "image",
        file_url: "https://storage.example.com/a.jpg",
      },
    });
  });
});
