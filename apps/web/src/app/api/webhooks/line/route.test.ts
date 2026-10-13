import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyLineSignature } from "@/lib/line/client";
import { POST } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/line/client", () => ({
  verifyLineSignature: vi.fn(),
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
