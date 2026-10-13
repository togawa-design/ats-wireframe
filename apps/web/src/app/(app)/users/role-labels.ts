import type { StaffRole } from "@/generated/prisma/client";

// "use client" ファイル(role-select.tsx)からServer Component(page.tsx)へ
// プレーンな定数をそのままexportすると、Next.jsがモジュール全体をクライアント
// 参照として扱ってしまい値が正しく渡らない。そのためラベル定義だけこの
// "use client" を付けないファイルに分離している。
export const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "管理者",
  recruiter: "採用担当",
  interviewer: "面接官",
  viewer: "閲覧のみ",
};
