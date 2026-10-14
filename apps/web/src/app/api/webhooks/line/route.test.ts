import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyLineSignature, fetchLineMessageContent } from "@/lib/line/client";
import { uploadLineMessageImage } from "@/lib/firebase/storage";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/line/client", () => ({
  verifyLineSignature: vi.fn(),
  fetchLineMessageContent: vi.fn(),
}));
vi.mock("@/lib/firebase/storage", () => ({
  uploadLineMessageImage: vi.fn(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function makeRequest(body: unknown, signature: string | null = "valid-sig") {
  const headers = new Headers();
  if (signature) headers.set("x-line-signature", signature);
  return new Request("http://localhost/api/webhooks/line", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/line", () => {
  it("署名が不正なら401を返す", async () => {
    vi.mocked(verifyLineSignature).mockReturnValue(false);
    const res = await POST(makeRequest({ destination: "U1", events: [] }));
    expect(res.status).toBe(401);
    expect(prismaMock.lineMessage.create).not.toHaveBeenCalled();
  });

  it("未登録ユーザーからのメッセージは無視する", async () => {
    vi.mocked(verifyLineSignature).mockReturnValue(true);
    prismaMock.applicant.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeRequest({
        destination: "Ubot",
        events: [
          {
            type: "message",
            source: { type: "user", userId: "Uunknown" },
            message: { type: "text", id: "1", text: "hi" },
          },
        ],
      })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.lineMessage.create).not.toHaveBeenCalled();
  });

  it("登録済み応募者からのテキストメッセージをinboundとして記録する", async () => {
    vi.mocked(verifyLineSignature).mockReturnValue(true);
    prismaMock.applicant.findUnique.mockResolvedValue({ id: "applicant-1" } as never);
    const res = await POST(
      makeRequest({
        destination: "Ubot",
        events: [
          {
            type: "message",
            source: { type: "user", userId: "Uknown" },
            message: { type: "text", id: "1", text: "よろしくお願いします" },
          },
        ],
      })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.lineMessage.create).toHaveBeenCalledWith({
      data: {
        applicant_id: "applicant-1",
        direction: "inbound",
        message_type: "text",
        content: "よろしくお願いします",
      },
    });
  });

  it("登録済み応募者からの画像メッセージをアップロードしinboundとして記録する", async () => {
    vi.mocked(verifyLineSignature).mockReturnValue(true);
    prismaMock.applicant.findUnique.mockResolvedValue({ id: "applicant-1" } as never);
    vi.mocked(fetchLineMessageContent).mockResolvedValue({
      buffer: Buffer.from([1, 2, 3]),
      contentType: "image/jpeg",
    });
    vi.mocked(uploadLineMessageImage).mockResolvedValue("https://storage.example.com/a.jpg");

    const res = await POST(
      makeRequest({
        destination: "Ubot",
        events: [
          {
            type: "message",
            source: { type: "user", userId: "Uknown" },
            message: { type: "image", id: "msg-1" },
          },
        ],
      })
    );

    expect(res.status).toBe(200);
    expect(fetchLineMessageContent).toHaveBeenCalledWith("msg-1");
    expect(uploadLineMessageImage).toHaveBeenCalledWith(
      "applicant-1",
      Buffer.from([1, 2, 3]),
      "image/jpeg"
    );
    expect(prismaMock.lineMessage.create).toHaveBeenCalledWith({
      data: {
        applicant_id: "applicant-1",
        direction: "inbound",
        message_type: "image",
        file_url: "https://storage.example.com/a.jpg",
      },
    });
  });

  it("テキスト・画像以外のメッセージ種別(スタンプ等)は無視する", async () => {
    vi.mocked(verifyLineSignature).mockReturnValue(true);
    const res = await POST(
      makeRequest({
        destination: "Ubot",
        events: [
          {
            type: "message",
            source: { type: "user", userId: "Uknown" },
            message: { type: "sticker", id: "1" },
          },
        ],
      })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.applicant.findUnique).not.toHaveBeenCalled();
  });

  it("message以外のイベント(follow等)は無視する", async () => {
    vi.mocked(verifyLineSignature).mockReturnValue(true);
    const res = await POST(
      makeRequest({
        destination: "Ubot",
        events: [{ type: "follow", source: { type: "user", userId: "Uknown" } }],
      })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.applicant.findUnique).not.toHaveBeenCalled();
  });
});
