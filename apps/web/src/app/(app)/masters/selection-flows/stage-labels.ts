import type { StageType } from "@/generated/prisma/client";

// "use client" ファイルからServer Componentへプレーンな定数をexportすると
// モジュール全体がクライアント参照になり値が壊れる(詳細はselections機能の
// result-labels.ts参照)。そのためラベル定義はここに分離している。
export const STAGE_TYPE_LABELS: Record<StageType, string> = {
  entry: "エントリー",
  screening: "書類選考",
  interview_1st: "1次面接",
  interview_2nd: "2次面接",
  interview_final: "最終面接",
  offer: "内定",
  acceptance: "内定承諾",
};
