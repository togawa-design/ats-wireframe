import "server-only";
import { prisma } from "@/lib/prisma";
import { linkRichMenuToUser } from "./client";

/**
 * FR035: 応募者の現在のタグに基づいて、一致するルールのうち最も優先度の高いリッチメニューを
 * LINE側にそのユーザーの個別メニューとして紐付ける。応募者がLINE未連携、またはタグに
 * 一致する公開中のリッチメニューが無い場合は何もしない(その場合LINE側の既定メニューのまま)。
 * LINE側APIの失敗はタグ更新自体を失敗させないよう、ここで握りつぶす。
 */
export async function syncApplicantRichMenu(applicantId: string): Promise<void> {
  const applicant = await prisma.applicant.findUnique({
    where: { id: applicantId },
    select: { line_user_id: true, tags: { select: { tag_id: true } } },
  });
  if (!applicant?.line_user_id) return;

  const tagIds = applicant.tags.map((t) => t.tag_id);
  if (tagIds.length === 0) return;

  const matchingMenu = await prisma.richMenu.findFirst({
    where: {
      status: "published",
      line_rich_menu_id: { not: null },
      rules: { some: { tag_id: { in: tagIds } } },
    },
    orderBy: { priority: "desc" },
  });
  if (!matchingMenu?.line_rich_menu_id) return;

  try {
    await linkRichMenuToUser(applicant.line_user_id, matchingMenu.line_rich_menu_id);
  } catch {
    // LINE側の紐付け失敗はタグ更新自体の失敗とはしない(ログも監査ログの対象外の軽微な副作用のため省略)。
  }
}
