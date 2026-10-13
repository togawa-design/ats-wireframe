import type { SelectionResult } from "@/generated/prisma/client";

// "use client" ファイル(result-select.tsx)からServer Component(page.tsx)へ
// プレーンな定数をそのままexportすると、Next.jsがモジュール全体をクライアント
// 参照として扱ってしまい値が正しく渡らない。そのためラベル定義だけこの
// "use client" を付けないファイルに分離している。
export const RESULT_LABELS: Record<SelectionResult, string> = {
  pending: "選考中",
  passed: "通過",
  failed: "不合格",
  withdrawn: "辞退",
  offer_declined: "内定辞退",
};
