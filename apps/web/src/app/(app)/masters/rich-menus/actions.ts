"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { uploadRichMenuImage as uploadRichMenuImageToStorage } from "@/lib/firebase/storage";
import {
  createRichMenu as createLineRichMenu,
  uploadRichMenuImage as uploadLineRichMenuImage,
  setDefaultRichMenu,
  deleteRichMenu as deleteLineRichMenu,
  describeLineSendError,
  type RichMenuAreaAction,
} from "@/lib/line/client";
import {
  RICH_MENU_IMAGE_SIZE,
  RICH_MENU_LAYOUTS,
  isRichMenuLayoutKey,
} from "@/lib/line/rich-menu-layouts";

export type RichMenuActionResult = { ok: true } | { ok: false; error: string };

/** FR034: リッチメニューを下書きとして作成する(この時点ではLINE側には何も登録しない)。 */
export async function createRichMenu(formData: FormData): Promise<RichMenuActionResult> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const name = String(formData.get("name") ?? "").trim();
  const chatBarText = String(formData.get("chat_bar_text") ?? "").trim();
  const layoutRaw = String(formData.get("layout") ?? "");

  if (!name) return { ok: false, error: "名前を入力してください" };
  if (!chatBarText) return { ok: false, error: "チャットバーのテキストを入力してください" };
  if (chatBarText.length > 14) {
    return { ok: false, error: "チャットバーのテキストは14文字以内で入力してください" };
  }
  if (!isRichMenuLayoutKey(layoutRaw)) return { ok: false, error: "レイアウトを選択してください" };

  const layout = RICH_MENU_LAYOUTS[layoutRaw];
  const areas: RichMenuAreaAction[] = [];
  for (let i = 0; i < layout.bounds.length; i++) {
    const actionType = String(formData.get(`area_action_type_${i}`) ?? "");
    const label = String(formData.get(`area_label_${i}`) ?? "").trim() || `エリア${i + 1}`;
    if (actionType === "uri") {
      const uri = String(formData.get(`area_uri_${i}`) ?? "").trim();
      if (!uri) return { ok: false, error: `エリア${i + 1}の遷移先URLを入力してください` };
      areas.push({ actionType: "uri", label, uri });
    } else if (actionType === "message") {
      const text = String(formData.get(`area_text_${i}`) ?? "").trim();
      if (!text) return { ok: false, error: `エリア${i + 1}の送信メッセージを入力してください` };
      areas.push({ actionType: "message", label, text });
    } else {
      return { ok: false, error: `エリア${i + 1}のアクション種別を選択してください` };
    }
  }

  await prisma.richMenu.create({
    data: { name, chat_bar_text: chatBarText, layout: layoutRaw, areas, status: "draft" },
  });

  revalidatePath("/masters/rich-menus");
  return { ok: true };
}

/** リッチメニューを削除する(公開中の場合はLINE側のリッチメニューも削除する)。 */
export async function deleteRichMenuRecord(id: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const richMenu = await prisma.richMenu.findUniqueOrThrow({ where: { id } });
  if (richMenu.line_rich_menu_id) {
    await deleteLineRichMenu(richMenu.line_rich_menu_id).catch(() => {
      // LINE側に既に存在しない場合等も、DB側のレコード削除は進める。
    });
  }
  await prisma.richMenu.delete({ where: { id } });

  revalidatePath("/masters/rich-menus");
}

/**
 * FR034: 画像を登録してLINEへリッチメニューを公開する。
 * タグルールが1件も無いリッチメニューは、LINE側の既定(フォールバック)メニューとして設定する。
 */
export async function publishRichMenu(id: string, formData: FormData): Promise<RichMenuActionResult> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const richMenu = await prisma.richMenu.findUnique({ where: { id }, include: { rules: true } });
  if (!richMenu) return { ok: false, error: "リッチメニューが見つかりません" };

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "画像を選択してください" };
  }
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    return { ok: false, error: "PNGまたはJPEG画像を選択してください" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dimensions = await readImageSize(buffer);
  if (
    !dimensions ||
    dimensions.width !== RICH_MENU_IMAGE_SIZE.width ||
    dimensions.height !== RICH_MENU_IMAGE_SIZE.height
  ) {
    return {
      ok: false,
      error: `画像サイズは${RICH_MENU_IMAGE_SIZE.width}x${RICH_MENU_IMAGE_SIZE.height}pxにしてください`,
    };
  }

  const layout = RICH_MENU_LAYOUTS[richMenu.layout as keyof typeof RICH_MENU_LAYOUTS];
  const areas = richMenu.areas as unknown as RichMenuAreaAction[];

  try {
    // 公開し直す場合に備え、既存のLINE側リッチメニューがあれば先に削除する。
    if (richMenu.line_rich_menu_id) {
      await deleteLineRichMenu(richMenu.line_rich_menu_id).catch(() => {});
    }

    const lineRichMenuId = await createLineRichMenu({
      name: richMenu.name,
      chatBarText: richMenu.chat_bar_text,
      size: RICH_MENU_IMAGE_SIZE,
      areas: layout.bounds.map((bounds, i) => ({ bounds, action: areas[i] })),
    });
    await uploadLineRichMenuImage(lineRichMenuId, buffer, file.type);
    if (richMenu.rules.length === 0) {
      await setDefaultRichMenu(lineRichMenuId);
    }

    const imageUrl = await uploadRichMenuImageToStorage(id, buffer, file.type);

    await prisma.richMenu.update({
      where: { id },
      data: { status: "published", line_rich_menu_id: lineRichMenuId, image_url: imageUrl },
    });
  } catch (e) {
    return { ok: false, error: describeLineSendError(e) };
  }

  revalidatePath("/masters/rich-menus");
  revalidatePath(`/masters/rich-menus/${id}`);
  return { ok: true };
}

/** FR034: 公開を取り下げて下書きに戻す(LINE側のリッチメニューは削除する)。 */
export async function unpublishRichMenu(id: string): Promise<RichMenuActionResult> {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const richMenu = await prisma.richMenu.findUniqueOrThrow({ where: { id } });
  if (richMenu.line_rich_menu_id) {
    try {
      await deleteLineRichMenu(richMenu.line_rich_menu_id);
    } catch (e) {
      return { ok: false, error: describeLineSendError(e) };
    }
  }

  await prisma.richMenu.update({
    where: { id },
    data: { status: "draft", line_rich_menu_id: null },
  });

  revalidatePath("/masters/rich-menus");
  revalidatePath(`/masters/rich-menus/${id}`);
  return { ok: true };
}

/** FR035: タグ連動の自動切替ルールを追加する。 */
export async function addRichMenuRule(richMenuId: string, formData: FormData) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  const tagId = String(formData.get("tag_id") ?? "");
  if (!tagId) throw new Error("タグを選択してください");

  await prisma.richMenuRule.upsert({
    where: { rich_menu_id_tag_id: { rich_menu_id: richMenuId, tag_id: tagId } },
    create: { rich_menu_id: richMenuId, tag_id: tagId },
    update: {},
  });

  revalidatePath(`/masters/rich-menus/${richMenuId}`);
}

export async function removeRichMenuRule(richMenuId: string, ruleId: string) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);

  await prisma.richMenuRule.delete({ where: { id: ruleId } });

  revalidatePath(`/masters/rich-menus/${richMenuId}`);
}

/** FR034: 複数のメニューが同時に一致した場合の優先順位を更新する。 */
export async function updateRichMenuPriority(id: string, priority: number) {
  const staff = await getCurrentStaff();
  if (!staff) throw new Error("ログインが必要です");
  assertCanManage(staff);
  if (!Number.isInteger(priority)) throw new Error("優先順位は整数で入力してください");

  await prisma.richMenu.update({ where: { id }, data: { priority } });
  revalidatePath("/masters/rich-menus");
}

/** PNG/JPEGのバイナリからピクセルサイズを読み取る(軽量な自前パーサ、外部依存を増やさないため)。 */
async function readImageSize(buffer: Buffer): Promise<{ width: number; height: number } | null> {
  // PNG: シグネチャ8バイト + IHDRチャンク(幅・高さは先頭から16,20バイト目のビッグエンディアン32bit)。
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  // JPEG: SOFマーカー(0xFFC0〜0xFFC3等)を走査し、その直後の高さ・幅(各2バイト)を読む。
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
  }
  return null;
}
