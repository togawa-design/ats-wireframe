import { afterEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn().mockResolvedValue(undefined);
const makePublicMock = vi.fn().mockResolvedValue(undefined);
const fileMock = vi.fn(() => ({ save: saveMock, makePublic: makePublicMock }));
const bucketMock = vi.fn(() => ({ name: "test-bucket", file: fileMock }));

vi.mock("firebase-admin/storage", () => ({
  getStorage: vi.fn(() => ({ bucket: bucketMock })),
}));
vi.mock("./admin", () => ({ adminApp: {} }));

import { uploadApplicantFile, uploadLineMessageImage } from "./storage";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("uploadApplicantFile", () => {
  it("applicants/配下のパスにアップロードし、公開URLを返す", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "fujiarte-ats");
    const file = new File([new Uint8Array(4)], "es.pdf", { type: "application/pdf" });

    const url = await uploadApplicantFile("applicant-1", "resume", file);

    expect(fileMock).toHaveBeenCalledWith(expect.stringMatching(/^applicants\/applicant-1\/resume-\d+\.pdf$/));
    expect(saveMock).toHaveBeenCalledWith(expect.any(Buffer), { contentType: "application/pdf" });
    expect(makePublicMock).toHaveBeenCalled();
    expect(url).toMatch(/^https:\/\/storage\.googleapis\.com\/test-bucket\/applicants\/applicant-1\/resume-\d+\.pdf$/);
  });
});

describe("uploadLineMessageImage", () => {
  it("line-messages/配下のパスにアップロードし、公開URLを返す", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "fujiarte-ats");
    const buffer = Buffer.from([1, 2, 3]);

    const url = await uploadLineMessageImage("applicant-1", buffer, "image/jpeg");

    expect(fileMock).toHaveBeenCalledWith(expect.stringMatching(/^line-messages\/applicant-1\/\d+\.jpg$/));
    expect(saveMock).toHaveBeenCalledWith(buffer, { contentType: "image/jpeg" });
    expect(url).toMatch(/^https:\/\/storage\.googleapis\.com\/test-bucket\/line-messages\/applicant-1\/\d+\.jpg$/);
  });

  it("content-typeがpngならpng拡張子にする", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "fujiarte-ats");
    const buffer = Buffer.from([1, 2, 3]);

    const url = await uploadLineMessageImage("applicant-1", buffer, "image/png");

    expect(url).toMatch(/\.png$/);
  });
});
