import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/permissions";
import { getAllApplicantsForExport } from "@/lib/analytics";
import { toCsv } from "@/lib/csv";

const APPLICANT_TYPE_LABELS: Record<string, string> = {
  new_grad: "新卒",
  existing_grad: "既卒",
  second_grad: "第二新卒",
};
const HIRE_TYPE_LABELS: Record<string, string> = { new_grad: "新卒", mid_career: "中途" };

/** FR053: 全データエクスポート(応募者一覧CSV)。 */
export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff || !canViewAnalytics(staff)) {
    return NextResponse.json({ error: "この操作を行う権限がありません" }, { status: 403 });
  }

  const applicants = await getAllApplicantsForExport();
  const rows = applicants.map((applicant) => ({
    last_name: applicant.last_name,
    first_name: applicant.first_name,
    email: applicant.email,
    school: applicant.school?.name ?? "",
    applicant_type: APPLICANT_TYPE_LABELS[applicant.applicant_type] ?? applicant.applicant_type,
    hire_type: HIRE_TYPE_LABELS[applicant.hire_type] ?? applicant.hire_type,
    current_stage: applicant.selection?.current_stage.name ?? "",
    created_at: applicant.created_at.toISOString(),
  }));

  const csv = toCsv(rows, [
    { key: "last_name", label: "姓" },
    { key: "first_name", label: "名" },
    { key: "email", label: "メールアドレス" },
    { key: "school", label: "学校" },
    { key: "applicant_type", label: "応募者区分" },
    { key: "hire_type", label: "新卒/中途" },
    { key: "current_stage", label: "現在のステージ" },
    { key: "created_at", label: "登録日時" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="applicants_${Date.now()}.csv"`,
    },
  });
}
