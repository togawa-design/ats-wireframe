import { describe, expect, it } from "vitest";
import {
  canManage,
  canSendLine,
  canRecordInterview,
  canDeleteInterview,
  isAdmin,
  isRestrictedToOwnApplicants,
  canViewAnalytics,
  restrictedPositionType,
  canAccessPositionType,
  assertCanManage,
  assertIsAdmin,
} from "./permissions";
import type { StaffPositionAccess, StaffRole } from "@/generated/prisma/client";

function staff(role: StaffRole, positionTypeAccess: StaffPositionAccess = "both") {
  return { id: "s1", role, position_type_access: positionTypeAccess };
}

describe("canManage", () => {
  it("管理者・採用担当はtrue", () => {
    expect(canManage(staff("admin"))).toBe(true);
    expect(canManage(staff("recruiter"))).toBe(true);
  });
  it("面接官・閲覧のみはfalse", () => {
    expect(canManage(staff("interviewer"))).toBe(false);
    expect(canManage(staff("viewer"))).toBe(false);
  });
});

describe("canSendLine", () => {
  it("管理者・採用担当のみtrue", () => {
    expect(canSendLine(staff("admin"))).toBe(true);
    expect(canSendLine(staff("recruiter"))).toBe(true);
    expect(canSendLine(staff("interviewer"))).toBe(false);
    expect(canSendLine(staff("viewer"))).toBe(false);
  });
});

describe("canRecordInterview", () => {
  it("閲覧のみ以外はtrue", () => {
    expect(canRecordInterview(staff("admin"))).toBe(true);
    expect(canRecordInterview(staff("recruiter"))).toBe(true);
    expect(canRecordInterview(staff("interviewer"))).toBe(true);
    expect(canRecordInterview(staff("viewer"))).toBe(false);
  });
});

describe("canDeleteInterview", () => {
  it("管理者・採用担当のみtrue(面接官は入力のみ)", () => {
    expect(canDeleteInterview(staff("admin"))).toBe(true);
    expect(canDeleteInterview(staff("recruiter"))).toBe(true);
    expect(canDeleteInterview(staff("interviewer"))).toBe(false);
    expect(canDeleteInterview(staff("viewer"))).toBe(false);
  });
});

describe("isAdmin / isRestrictedToOwnApplicants", () => {
  it("isAdminは管理者のみtrue", () => {
    expect(isAdmin(staff("admin"))).toBe(true);
    expect(isAdmin(staff("recruiter"))).toBe(false);
  });
  it("isRestrictedToOwnApplicantsは面接官のみtrue", () => {
    expect(isRestrictedToOwnApplicants(staff("interviewer"))).toBe(true);
    expect(isRestrictedToOwnApplicants(staff("viewer"))).toBe(false);
    expect(isRestrictedToOwnApplicants(staff("admin"))).toBe(false);
  });
});

describe("canViewAnalytics", () => {
  it("面接官以外はtrue", () => {
    expect(canViewAnalytics(staff("admin"))).toBe(true);
    expect(canViewAnalytics(staff("recruiter"))).toBe(true);
    expect(canViewAnalytics(staff("viewer"))).toBe(true);
    expect(canViewAnalytics(staff("interviewer"))).toBe(false);
  });
});

describe("restrictedPositionType", () => {
  it("bothならnull(制限なし)", () => {
    expect(restrictedPositionType(staff("recruiter", "both"))).toBeNull();
  });
  it("sogo/ginoならその値を返す", () => {
    expect(restrictedPositionType(staff("recruiter", "sogo"))).toBe("sogo");
    expect(restrictedPositionType(staff("recruiter", "gino"))).toBe("gino");
  });
});

describe("canAccessPositionType", () => {
  it("bothのスタッフはどの職種区分でもtrue", () => {
    const s = staff("recruiter", "both");
    expect(canAccessPositionType(s, "sogo")).toBe(true);
    expect(canAccessPositionType(s, "gino")).toBe(true);
    expect(canAccessPositionType(s, null)).toBe(true);
  });

  it("sogo限定のスタッフはsogoと未設定のみtrue", () => {
    const s = staff("recruiter", "sogo");
    expect(canAccessPositionType(s, "sogo")).toBe(true);
    expect(canAccessPositionType(s, null)).toBe(true);
    expect(canAccessPositionType(s, "gino")).toBe(false);
  });

  it("gino限定のスタッフはginoと未設定のみtrue", () => {
    const s = staff("recruiter", "gino");
    expect(canAccessPositionType(s, "gino")).toBe(true);
    expect(canAccessPositionType(s, null)).toBe(true);
    expect(canAccessPositionType(s, "sogo")).toBe(false);
  });
});

describe("assert系", () => {
  it("assertCanManageは権限が無ければ例外を投げる", () => {
    expect(() => assertCanManage(staff("viewer"))).toThrow("この操作を行う権限がありません");
    expect(() => assertCanManage(staff("admin"))).not.toThrow();
  });
  it("assertIsAdminは管理者以外なら例外を投げる", () => {
    expect(() => assertIsAdmin(staff("recruiter"))).toThrow("この操作を行う権限がありません");
    expect(() => assertIsAdmin(staff("admin"))).not.toThrow();
  });
});
