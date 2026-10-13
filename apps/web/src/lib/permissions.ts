import "server-only";
import type { StaffRole } from "@/generated/prisma/client";

/**
 * FR086 ロールベースアクセス制御。
 *   管理者: 全操作
 *   採用担当: 学生管理・LINE・分析(ユーザー管理以外の運用機能全般)
 *   面接官: 担当学生の閲覧・評価入力のみ(assigned_toが自分の学生のみ表示)
 *   閲覧のみ: データ閲覧・分析のみ
 */

type Staff = { id: string; role: StaffRole };

/** 応募者・選考・媒体マスター等の作成/削除ができるか(管理者・採用担当のみ)。 */
export function canManage(staff: Staff): boolean {
  return staff.role === "admin" || staff.role === "recruiter";
}

/** LINEメッセージの一斉送信ができるか(管理者・採用担当のみ)。 */
export function canSendLine(staff: Staff): boolean {
  return staff.role === "admin" || staff.role === "recruiter";
}

/** 面接記録(評価入力)を作成できるか(管理者・採用担当・面接官)。 */
export function canRecordInterview(staff: Staff): boolean {
  return staff.role !== "viewer";
}

/** 面接記録を削除できるか(管理者・採用担当のみ。面接官は入力のみで削除不可)。 */
export function canDeleteInterview(staff: Staff): boolean {
  return canManage(staff);
}

/** ユーザー管理画面を操作できるか(管理者のみ)。 */
export function isAdmin(staff: Staff): boolean {
  return staff.role === "admin";
}

/** 面接官ロールは、自分が assigned_to の応募者のみ閲覧可能(FR086)。 */
export function isRestrictedToOwnApplicants(staff: Staff): boolean {
  return staff.role === "interviewer";
}

export function assertCanManage(staff: Staff) {
  if (!canManage(staff)) throw new Error("この操作を行う権限がありません");
}

export function assertCanSendLine(staff: Staff) {
  if (!canSendLine(staff)) throw new Error("この操作を行う権限がありません");
}

export function assertCanRecordInterview(staff: Staff) {
  if (!canRecordInterview(staff)) throw new Error("この操作を行う権限がありません");
}

export function assertCanDeleteInterview(staff: Staff) {
  if (!canDeleteInterview(staff)) throw new Error("この操作を行う権限がありません");
}

export function assertIsAdmin(staff: Staff) {
  if (!isAdmin(staff)) throw new Error("この操作を行う権限がありません");
}
