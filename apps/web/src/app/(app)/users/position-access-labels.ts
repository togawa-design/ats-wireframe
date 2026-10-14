import type { StaffPositionAccess } from "@/generated/prisma/client";

// role-labels.ts と同じ理由("use client"から定数をexportするとクライアント参照に
// なってしまう問題を避けるため)でこのファイルは"use client"を付けない。
export const POSITION_ACCESS_LABELS: Record<StaffPositionAccess, string> = {
  both: "全職種",
  sogo: "総合職のみ",
  gino: "技能職のみ",
};
