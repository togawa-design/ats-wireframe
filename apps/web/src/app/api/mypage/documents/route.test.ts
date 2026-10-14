import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line/verify-id-token";
import { uploadApplicantFile } from "@/lib/firebase/storage";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/line/verify-id-token", () => ({
  verifyLiffIdToken: vi.fn(),
}));
vi.mock("@/lib/firebase/storage", () => ({
  uploadApplicantFile: vi.fn(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function makeRequest(formData: FormData, authHeader?: string) {
  return new Request("http://localhost/api/mypage/documents", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
    body: formData,
  });
}

function pdfFile(name = "es.pdf", size = 100) {
  return new File([new Uint8Array(size)], name, { type: "application/pdf" });
}

function jpgFile(name = "photo.jpg", size = 100) {
  return new File([new Uint8Array(size)], name, { type: "image/jpeg" });
}

describe("POST /api/mypage/documents", () => {
  it("Authorizationヘッダーが無ければ401", async () => {
    const form = new FormData();
    form.set("kind", "resume");
    form.set("file", pdfFile());

    const res = await POST(makeRequest(form));

    expect(res.status).toBe(401);
    expect(uploadApplicantFile).not.toHaveBeenCalled();
  });

  it("kindが不正なら400", async () => {
    vi.mocked(verifyLiffIdToken).mockResolvedValue("U123");
    prismaMock.applicant.findUnique.mockResolvedValue({ id: "applicant-1" } as never);
    const form = new FormData();
    form.set("kind", "invalid");
    form.set("file", pdfFile());

    const res = await POST(makeRequest(form, "Bearer token"));

    expect(res.status).toBe(400);
  });

  it("ファイルが無ければ400", async () => {
    vi.mocked(verifyLiffIdToken).mockResolvedValue("U123");
    prismaMock.applicant.findUnique.mockResolvedValue({ id: "applicant-1" } as never);
    const form = new FormData();
    form.set("kind", "resume");

    const res = await POST(makeRequest(form, "Bearer token"));

    expect(res.status).toBe(400);
  });

  it("5MBを超えるファイルは400", async () => {
    vi.mocked(verifyLiffIdToken).mockResolvedValue("U123");
    prismaMock.applicant.findUnique.mockResolvedValue({ id: "applicant-1" } as never);
    const form = new FormData();
    form.set("kind", "resume");
    form.set("file", pdfFile("big.pdf", 5 * 1024 * 1024 + 1));

    const res = await POST(makeRequest(form, "Bearer token"));

    expect(res.status).toBe(400);
  });

  it("resumeにPDF以外を渡すと400", async () => {
    vi.mocked(verifyLiffIdToken).mockResolvedValue("U123");
    prismaMock.applicant.findUnique.mockResolvedValue({ id: "applicant-1" } as never);
    const form = new FormData();
    form.set("kind", "resume");
    form.set("file", jpgFile());

    const res = await POST(makeRequest(form, "Bearer token"));

    expect(res.status).toBe(400);
  });

  it("有効なPDFならアップロードしresume_urlを更新する", async () => {
    vi.mocked(verifyLiffIdToken).mockResolvedValue("U123");
    prismaMock.applicant.findUnique.mockResolvedValue({ id: "applicant-1" } as never);
    vi.mocked(uploadApplicantFile).mockResolvedValue("https://storage.example.com/es.pdf");
    const form = new FormData();
    form.set("kind", "resume");
    form.set("file", pdfFile());

    const res = await POST(makeRequest(form, "Bearer token"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe("https://storage.example.com/es.pdf");
    expect(uploadApplicantFile).toHaveBeenCalledWith("applicant-1", "resume", expect.any(File));
    expect(prismaMock.applicant.update).toHaveBeenCalledWith({
      where: { id: "applicant-1" },
      data: { resume_url: "https://storage.example.com/es.pdf" },
    });
  });

  it("有効なJPGならphoto_urlを更新する", async () => {
    vi.mocked(verifyLiffIdToken).mockResolvedValue("U123");
    prismaMock.applicant.findUnique.mockResolvedValue({ id: "applicant-1" } as never);
    vi.mocked(uploadApplicantFile).mockResolvedValue("https://storage.example.com/photo.jpg");
    const form = new FormData();
    form.set("kind", "photo");
    form.set("file", jpgFile());

    const res = await POST(makeRequest(form, "Bearer token"));

    expect(res.status).toBe(200);
    expect(prismaMock.applicant.update).toHaveBeenCalledWith({
      where: { id: "applicant-1" },
      data: { photo_url: "https://storage.example.com/photo.jpg" },
    });
  });
});
