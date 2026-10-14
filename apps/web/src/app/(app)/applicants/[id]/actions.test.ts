import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { uploadApplicantFile } from "@/lib/firebase/storage";
import { recordAuditLog } from "@/lib/audit-log";
import { uploadApplicantDocument } from "./actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("@/lib/audit-log", () => ({
  recordAuditLog: vi.fn(),
}));
vi.mock("@/lib/firebase/storage", () => ({
  uploadApplicantFile: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockStaff = { id: "staff-1", role: "admin" } as never;

function pdfFile(name = "es.pdf", size = 100) {
  return new File([new Uint8Array(size)], name, { type: "application/pdf" });
}
function jpgFile(name = "photo.jpg", size = 100) {
  return new File([new Uint8Array(size)], name, { type: "image/jpeg" });
}

function buildForm(kind: string, file?: File) {
  const form = new FormData();
  form.set("kind", kind);
  if (file) form.set("file", file);
  return form;
}

describe("uploadApplicantDocument", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(
      uploadApplicantDocument("applicant-1", buildForm("resume", pdfFile()))
    ).rejects.toThrow("ログインが必要です");
    expect(uploadApplicantFile).not.toHaveBeenCalled();
  });

  it("閲覧のみロールでは権限エラーになる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue({ id: "staff-2", role: "viewer" } as never);
    await expect(
      uploadApplicantDocument("applicant-1", buildForm("resume", pdfFile()))
    ).rejects.toThrow("この操作を行う権限がありません");
  });

  it("kindが不正なら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await expect(
      uploadApplicantDocument("applicant-1", buildForm("invalid", pdfFile()))
    ).rejects.toThrow("kindが不正です");
  });

  it("ファイルが無ければ例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await expect(uploadApplicantDocument("applicant-1", buildForm("resume"))).rejects.toThrow(
      "ファイルを選択してください"
    );
  });

  it("5MBを超えるファイルは例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await expect(
      uploadApplicantDocument(
        "applicant-1",
        buildForm("resume", pdfFile("big.pdf", 5 * 1024 * 1024 + 1))
      )
    ).rejects.toThrow("ファイルサイズは5MB以下にしてください");
  });

  it("resumeにPDF以外を渡すと例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await expect(
      uploadApplicantDocument("applicant-1", buildForm("resume", jpgFile()))
    ).rejects.toThrow("PDFファイルを選択してください");
  });

  it("有効なPDFならアップロードしresume_urlを更新する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    vi.mocked(uploadApplicantFile).mockResolvedValue("https://storage.example.com/es.pdf");

    await uploadApplicantDocument("applicant-1", buildForm("resume", pdfFile()));

    expect(uploadApplicantFile).toHaveBeenCalledWith("applicant-1", "resume", expect.any(File));
    expect(prismaMock.applicant.update).toHaveBeenCalledWith({
      where: { id: "applicant-1" },
      data: { resume_url: "https://storage.example.com/es.pdf" },
    });
    expect(recordAuditLog).toHaveBeenCalledWith({
      staffId: "staff-1",
      action: "edit_applicant",
      targetType: "Applicant",
      targetId: "applicant-1",
      afterValue: { kind: "resume", url: "https://storage.example.com/es.pdf" },
    });
  });

  it("有効なJPGならphoto_urlを更新する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    vi.mocked(uploadApplicantFile).mockResolvedValue("https://storage.example.com/photo.jpg");

    await uploadApplicantDocument("applicant-1", buildForm("photo", jpgFile()));

    expect(prismaMock.applicant.update).toHaveBeenCalledWith({
      where: { id: "applicant-1" },
      data: { photo_url: "https://storage.example.com/photo.jpg" },
    });
  });
});
