import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["host", "ats.example.com"]])),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/qr/[id]/image", () => {
  it("存在しないQRコードなら404を返す", async () => {
    prismaMock.qRCode.findUnique.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/qr/missing/image"), makeContext("missing"));

    expect(res.status).toBe(404);
  });

  it("存在するQRコードならPNG画像を返す", async () => {
    prismaMock.qRCode.findUnique.mockResolvedValue({
      id: "qr-1",
      liff_url: "https://example.com",
    } as never);

    const res = await GET(new Request("http://localhost/api/qr/qr-1/image"), makeContext("qr-1"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });
});
