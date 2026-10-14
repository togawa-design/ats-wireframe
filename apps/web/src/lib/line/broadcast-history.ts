import "server-only";
import { prisma } from "@/lib/prisma";

export type BroadcastHistoryItem = {
  id: string;
  sentAt: Date;
  templateText: string;
  tagName: string | null;
  senderName: string;
  recipientCount: number;
  sentCount: number;
  openedCount: number;
};

/**
 * FR033: LINE一斉送信の送信履歴・開封集計(直近50件)。
 * 個人単位の既読取得はLINE API仕様上できないため(U-01)、「マイページアクセス日時が
 * 送信日時より後か」を開封の代替指標として集計する。
 */
export async function getBroadcastHistory(): Promise<BroadcastHistoryItem[]> {
  const broadcasts = await prisma.lineBroadcast.findMany({
    orderBy: { sent_at: "desc" },
    take: 50,
    include: {
      tag: true,
      sender: { select: { name: true } },
      messages: { select: { applicant: { select: { mypage_last_accessed_at: true } } } },
    },
  });

  return broadcasts.map((broadcast) => ({
    id: broadcast.id,
    sentAt: broadcast.sent_at,
    templateText: broadcast.template_text,
    tagName: broadcast.tag?.name ?? null,
    senderName: broadcast.sender.name,
    recipientCount: broadcast.recipient_count,
    sentCount: broadcast.sent_count,
    openedCount: broadcast.messages.filter(
      (message) =>
        message.applicant.mypage_last_accessed_at !== null &&
        message.applicant.mypage_last_accessed_at > broadcast.sent_at
    ).length,
  }));
}
