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

import {
  sendTextMessage,
  sendImageMessage,
  fetchLineMessageContent,
  describeLineSendError,
  verifyLineSignature,
} from "./client";
import { validateSignature, HTTPFetchError } from "@line/bot-sdk";

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

describe("sendImageMessage", () => {
  it("チャネルアクセストークン未設定なら例外を投げる", async () => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "");
    await expect(sendImageMessage("U123", "https://example.com/a.jpg")).rejects.toThrow(
      "LINE_CHANNEL_ACCESS_TOKEN が設定されていません"
    );
  });

  it("設定済みならimageタイプでpushMessageを呼ぶ", async () => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "dummy-token");
    await sendImageMessage("U123", "https://example.com/a.jpg");
    expect(pushMessageMock).toHaveBeenCalledWith({
      to: "U123",
      messages: [
        {
          type: "image",
          originalContentUrl: "https://example.com/a.jpg",
          previewImageUrl: "https://example.com/a.jpg",
        },
      ],
    });
  });
});

describe("fetchLineMessageContent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("チャネルアクセストークン未設定なら例外を投げる", async () => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "");
    await expect(fetchLineMessageContent("msg-1")).rejects.toThrow(
      "LINE_CHANNEL_ACCESS_TOKEN が設定されていません"
    );
  });

  it("取得に失敗(非200)したら例外を投げる", async () => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "dummy-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchLineMessageContent("msg-1")).rejects.toThrow(
      "LINEメッセージの取得に失敗しました: 404"
    );
  });

  it("取得に成功したらbufferとcontent-typeを返す", async () => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "dummy-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([["content-type", "image/jpeg"]]),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchLineMessageContent("msg-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api-data.line.me/v2/bot/message/msg-1/content",
      { headers: { Authorization: "Bearer dummy-token" } }
    );
    expect(result.contentType).toBe("image/jpeg");
    expect(Buffer.compare(result.buffer, Buffer.from([1, 2, 3]))).toBe(0);
  });
});

describe("describeLineSendError", () => {
  it("HTTPFetchErrorはLINE側が返したbody.messageを優先して返す", () => {
    const error = new HTTPFetchError("400 - Bad Request", {
      status: 400,
      statusText: "Bad Request",
      headers: new Headers(),
      body: JSON.stringify({ message: "The property, 'to', in the request body is invalid" }),
    });
    expect(describeLineSendError(error)).toBe(
      "The property, 'to', in the request body is invalid"
    );
  });

  it("HTTPFetchErrorでbodyがJSONでなければerror.messageを返す", () => {
    const error = new HTTPFetchError("400 - Bad Request", {
      status: 400,
      statusText: "Bad Request",
      headers: new Headers(),
      body: "not json",
    });
    expect(describeLineSendError(error)).toBe("400 - Bad Request");
  });

  it("通常のErrorはmessageを返す", () => {
    expect(describeLineSendError(new Error("some error"))).toBe("some error");
  });

  it("Error以外はフォールバックメッセージを返す", () => {
    expect(describeLineSendError("string error")).toBe("LINE送信に失敗しました");
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
