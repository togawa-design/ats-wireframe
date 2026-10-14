import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyLiffIdToken } from "./verify-id-token";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("verifyLiffIdToken", () => {
  it("E2E環境では e2e: 接頭辞のトークンをそのままUserIdとして信頼する", async () => {
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099");

    const userId = await verifyLiffIdToken("e2e:Uabc123");

    expect(userId).toBe("Uabc123");
  });

  it("E2E環境でも e2e: 接頭辞が無ければ実際のLINE検証エンドポイントを呼ぶ", async () => {
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099");
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "12345");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sub: "Ureal" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const userId = await verifyLiffIdToken("real-token");

    expect(userId).toBe("Ureal");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.line.me/oauth2/v2.1/verify",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("LINE_LOGIN_CHANNEL_ID未設定なら例外を投げる", async () => {
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "");
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "");

    await expect(verifyLiffIdToken("token")).rejects.toThrow(
      "LINE_LOGIN_CHANNEL_ID が設定されていません"
    );
  });

  it("LINE側の検証が失敗(非200)なら例外を投げる", async () => {
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "");
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "12345");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    await expect(verifyLiffIdToken("bad-token")).rejects.toThrow("LINEログインの検証に失敗しました");
  });

  it("subが含まれないレスポンスなら例外を投げる", async () => {
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "");
    vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "12345");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    await expect(verifyLiffIdToken("token")).rejects.toThrow("LINEログインの検証に失敗しました");
  });
});
