import { describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import {
  createRichMenu as createLineRichMenu,
  uploadRichMenuImage as uploadLineRichMenuImage,
  setDefaultRichMenu,
  deleteRichMenu as deleteLineRichMenu,
} from "@/lib/line/client";
import { uploadRichMenuImage as uploadRichMenuImageToStorage } from "@/lib/firebase/storage";
import {
  createRichMenu,
  publishRichMenu,
  unpublishRichMenu,
  deleteRichMenuRecord,
  addRichMenuRule,
  removeRichMenuRule,
  updateRichMenuPriority,
} from "./actions";

vi.mock("@/lib/prisma", () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStaff: vi.fn(),
}));
vi.mock("@/lib/line/client", () => ({
  createRichMenu: vi.fn(),
  uploadRichMenuImage: vi.fn(),
  setDefaultRichMenu: vi.fn(),
  deleteRichMenu: vi.fn(),
  describeLineSendError: vi.fn((e: unknown) => (e instanceof Error ? e.message : "LINE送信に失敗しました")),
}));
vi.mock("@/lib/firebase/storage", () => ({
  uploadRichMenuImage: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockStaff = { id: "staff-1", role: "admin" } as never;

function fakePngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  buf.writeUInt32BE(0x89504e47, 0);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function createForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("name", "テストメニュー");
  form.set("chat_bar_text", "メニュー");
  form.set("layout", "two");
  form.set("area_action_type_0", "uri");
  form.set("area_label_0", "エリア1");
  form.set("area_uri_0", "https://example.com");
  form.set("area_action_type_1", "message");
  form.set("area_label_1", "エリア2");
  form.set("area_text_1", "こんにちは");
  for (const [k, v] of Object.entries(overrides)) form.set(k, v);
  return form;
}

describe("createRichMenu", () => {
  it("未ログインなら例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(null);
    await expect(createRichMenu(createForm())).rejects.toThrow("ログインが必要です");
  });

  it("名前が無ければエラーを返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const result = await createRichMenu(createForm({ name: "" }));
    expect(result).toEqual({ ok: false, error: "名前を入力してください" });
  });

  it("チャットバーのテキストが14文字を超えるとエラーを返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const result = await createRichMenu(createForm({ chat_bar_text: "あ".repeat(15) }));
    expect(result).toEqual({ ok: false, error: "チャットバーのテキストは14文字以内で入力してください" });
  });

  it("不正なレイアウトならエラーを返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const result = await createRichMenu(createForm({ layout: "eight" }));
    expect(result).toEqual({ ok: false, error: "レイアウトを選択してください" });
  });

  it("URLアクションでURL未入力ならエラーを返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const result = await createRichMenu(createForm({ area_uri_0: "" }));
    expect(result).toEqual({ ok: false, error: "エリア1の遷移先URLを入力してください" });
  });

  it("メッセージアクションで本文未入力ならエラーを返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const result = await createRichMenu(createForm({ area_text_1: "" }));
    expect(result).toEqual({ ok: false, error: "エリア2の送信メッセージを入力してください" });
  });

  it("有効な入力であれば下書きとして作成する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);

    const result = await createRichMenu(createForm());

    expect(result).toEqual({ ok: true });
    expect(prismaMock.richMenu.create).toHaveBeenCalledWith({
      data: {
        name: "テストメニュー",
        chat_bar_text: "メニュー",
        layout: "two",
        status: "draft",
        areas: [
          { actionType: "uri", label: "エリア1", uri: "https://example.com" },
          { actionType: "message", label: "エリア2", text: "こんにちは" },
        ],
      },
    });
  });
});

describe("publishRichMenu", () => {
  it("画像が無ければエラーを返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.richMenu.findUnique.mockResolvedValue({
      id: "rm-1",
      name: "テスト",
      chat_bar_text: "メニュー",
      layout: "one",
      areas: [{ actionType: "uri", label: "エリア1", uri: "https://example.com" }],
      line_rich_menu_id: null,
      rules: [],
    } as never);

    const result = await publishRichMenu("rm-1", new FormData());

    expect(result).toEqual({ ok: false, error: "画像を選択してください" });
  });

  it("サイズが合わない画像はエラーを返す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.richMenu.findUnique.mockResolvedValue({
      id: "rm-1",
      name: "テスト",
      chat_bar_text: "メニュー",
      layout: "one",
      areas: [{ actionType: "uri", label: "エリア1", uri: "https://example.com" }],
      line_rich_menu_id: null,
      rules: [],
    } as never);
    const form = new FormData();
    form.set(
      "image",
      new File([Uint8Array.from(fakePngBuffer(100, 100))], "a.png", { type: "image/png" })
    );

    const result = await publishRichMenu("rm-1", form);

    expect(result).toEqual({ ok: false, error: "画像サイズは2500x1686pxにしてください" });
  });

  it("ルールが無いメニューは既定メニューとしてLINEに登録する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.richMenu.findUnique.mockResolvedValue({
      id: "rm-1",
      name: "テスト",
      chat_bar_text: "メニュー",
      layout: "one",
      areas: [{ actionType: "uri", label: "エリア1", uri: "https://example.com" }],
      line_rich_menu_id: null,
      rules: [],
    } as never);
    vi.mocked(createLineRichMenu).mockResolvedValue("line-rm-1");
    vi.mocked(uploadRichMenuImageToStorage).mockResolvedValue("https://storage.example.com/rm.png");
    const form = new FormData();
    form.set(
      "image",
      new File([Uint8Array.from(fakePngBuffer(2500, 1686))], "a.png", { type: "image/png" })
    );

    const result = await publishRichMenu("rm-1", form);

    expect(result).toEqual({ ok: true });
    expect(createLineRichMenu).toHaveBeenCalledWith({
      name: "テスト",
      chatBarText: "メニュー",
      size: { width: 2500, height: 1686 },
      areas: [
        {
          bounds: { x: 0, y: 0, width: 2500, height: 1686 },
          action: { actionType: "uri", label: "エリア1", uri: "https://example.com" },
        },
      ],
    });
    expect(uploadLineRichMenuImage).toHaveBeenCalledWith(
      "line-rm-1",
      expect.any(Buffer),
      "image/png"
    );
    expect(setDefaultRichMenu).toHaveBeenCalledWith("line-rm-1");
    expect(prismaMock.richMenu.update).toHaveBeenCalledWith({
      where: { id: "rm-1" },
      data: {
        status: "published",
        line_rich_menu_id: "line-rm-1",
        image_url: "https://storage.example.com/rm.png",
      },
    });
  });

  it("ルールがあるメニューは既定メニューとしては登録しない", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.richMenu.findUnique.mockResolvedValue({
      id: "rm-1",
      name: "テスト",
      chat_bar_text: "メニュー",
      layout: "one",
      areas: [{ actionType: "uri", label: "エリア1", uri: "https://example.com" }],
      line_rich_menu_id: null,
      rules: [{ id: "rule-1" }],
    } as never);
    vi.mocked(createLineRichMenu).mockResolvedValue("line-rm-2");
    vi.mocked(uploadRichMenuImageToStorage).mockResolvedValue("https://storage.example.com/rm2.png");
    const form = new FormData();
    form.set(
      "image",
      new File([Uint8Array.from(fakePngBuffer(2500, 1686))], "a.png", { type: "image/png" })
    );

    await publishRichMenu("rm-1", form);

    expect(setDefaultRichMenu).not.toHaveBeenCalled();
  });

  it("LINE APIが失敗した場合はエラーを返しDBは更新しない", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.richMenu.findUnique.mockResolvedValue({
      id: "rm-1",
      name: "テスト",
      chat_bar_text: "メニュー",
      layout: "one",
      areas: [{ actionType: "uri", label: "エリア1", uri: "https://example.com" }],
      line_rich_menu_id: null,
      rules: [],
    } as never);
    vi.mocked(createLineRichMenu).mockRejectedValue(new Error("LINE API error"));
    const form = new FormData();
    form.set(
      "image",
      new File([Uint8Array.from(fakePngBuffer(2500, 1686))], "a.png", { type: "image/png" })
    );

    const result = await publishRichMenu("rm-1", form);

    expect(result).toEqual({ ok: false, error: "LINE API error" });
    expect(prismaMock.richMenu.update).not.toHaveBeenCalled();
  });
});

describe("unpublishRichMenu", () => {
  it("LINE側のリッチメニューを削除し下書きに戻す", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.richMenu.findUniqueOrThrow.mockResolvedValue({
      id: "rm-1",
      line_rich_menu_id: "line-rm-1",
    } as never);

    const result = await unpublishRichMenu("rm-1");

    expect(result).toEqual({ ok: true });
    expect(deleteLineRichMenu).toHaveBeenCalledWith("line-rm-1");
    expect(prismaMock.richMenu.update).toHaveBeenCalledWith({
      where: { id: "rm-1" },
      data: { status: "draft", line_rich_menu_id: null },
    });
  });
});

describe("deleteRichMenuRecord", () => {
  it("公開中の場合はLINE側も削除してからレコードを削除する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.richMenu.findUniqueOrThrow.mockResolvedValue({
      id: "rm-1",
      line_rich_menu_id: "line-rm-1",
    } as never);
    vi.mocked(deleteLineRichMenu).mockResolvedValue({} as never);

    await deleteRichMenuRecord("rm-1");

    expect(deleteLineRichMenu).toHaveBeenCalledWith("line-rm-1");
    expect(prismaMock.richMenu.delete).toHaveBeenCalledWith({ where: { id: "rm-1" } });
  });

  it("下書き(line_rich_menu_id無し)の場合はLINE削除を呼ばない", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    prismaMock.richMenu.findUniqueOrThrow.mockResolvedValue({
      id: "rm-2",
      line_rich_menu_id: null,
    } as never);
    vi.mocked(deleteLineRichMenu).mockClear();

    await deleteRichMenuRecord("rm-2");

    expect(deleteLineRichMenu).not.toHaveBeenCalled();
    expect(prismaMock.richMenu.delete).toHaveBeenCalledWith({ where: { id: "rm-2" } });
  });
});

describe("addRichMenuRule / removeRichMenuRule", () => {
  it("タグ未選択ならaddRichMenuRuleは例外を投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await expect(addRichMenuRule("rm-1", new FormData())).rejects.toThrow("タグを選択してください");
  });

  it("addRichMenuRuleはupsertでルールを追加する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    const form = new FormData();
    form.set("tag_id", "tag-1");

    await addRichMenuRule("rm-1", form);

    expect(prismaMock.richMenuRule.upsert).toHaveBeenCalledWith({
      where: { rich_menu_id_tag_id: { rich_menu_id: "rm-1", tag_id: "tag-1" } },
      create: { rich_menu_id: "rm-1", tag_id: "tag-1" },
      update: {},
    });
  });

  it("removeRichMenuRuleはルールを削除する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);

    await removeRichMenuRule("rm-1", "rule-1");

    expect(prismaMock.richMenuRule.delete).toHaveBeenCalledWith({ where: { id: "rule-1" } });
  });
});

describe("updateRichMenuPriority", () => {
  it("整数以外はエラーを投げる", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);
    await expect(updateRichMenuPriority("rm-1", 1.5)).rejects.toThrow(
      "優先順位は整数で入力してください"
    );
  });

  it("優先順位を更新する", async () => {
    vi.mocked(getCurrentStaff).mockResolvedValue(mockStaff);

    await updateRichMenuPriority("rm-1", 5);

    expect(prismaMock.richMenu.update).toHaveBeenCalledWith({
      where: { id: "rm-1" },
      data: { priority: 5 },
    });
  });
});
