import { afterEach, describe, expect, it, vi } from "vitest";

const pushMessageMock = vi.fn();
vi.mock("@line/bot-sdk", async () => {
  const actual = await vi.importActual<typeof import("@line/bot-sdk")>("@line/bot-sdk");
  return {
    ...actual,
    messagingApi: {
      MessagingApiClient: class {
        pushMessage = pushMessageMock;
      },
    },
    validateSignature: vi.fn(),
  };
});

import { sendTextMessage, verifyLineSignature } from "./client";
import { validateSignature } from "@line/bot-sdk";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("sendTextMessage", () => {
  it("チャネルアクセストークン未設定なら例外を投げる", async () => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "");
    await expect(sendTextMessage("U123", "hello")).rejects.toThrow(
      "LINE_CHANNEL_ACCESS_TOKEN が設定されていません"
    );
  });

  it("設定済みならpushMessageを呼ぶ", async () => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "dummy-token");
    await sendTextMessage("U123", "こんにちは");
    expect(pushMessageMock).toHaveBeenCalledWith({
      to: "U123",
      messages: [{ type: "text", text: "こんにちは" }],
    });
  });
});

describe("verifyLineSignature", () => {
  it("チャネルシークレット未設定ならfalse", () => {
    vi.stubEnv("LINE_CHANNEL_SECRET", "");
    expect(verifyLineSignature("body", "sig")).toBe(false);
  });

  it("署名が無ければfalse", () => {
    vi.stubEnv("LINE_CHANNEL_SECRET", "secret");
    expect(verifyLineSignature("body", null)).toBe(false);
  });

  it("設定済みならvalidateSignatureの結果を返す", () => {
    vi.stubEnv("LINE_CHANNEL_SECRET", "secret");
    vi.mocked(validateSignature).mockReturnValue(true);
    expect(verifyLineSignature("body", "sig")).toBe(true);
    expect(validateSignature).toHaveBeenCalledWith("body", "secret", "sig");
  });
});
