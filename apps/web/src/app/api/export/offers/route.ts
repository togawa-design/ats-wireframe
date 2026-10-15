import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { canViewAnalytics, restrictedPositionType } from "@/lib/permissions";
import { getOfferAndAcceptanceSelections, parseFromDate, parseToDate } from "@/lib/analytics";
import { toCsv } from "@/lib/csv";
import { recordAuditLog } from "@/lib/audit-log";

/** FR052: 内定者・承諾者一覧CSV。FR103: ?from=&to=(YYYY-MM-DD)で集計期間を指定できる。 */
export async function GET(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff || !canViewAnalytics(staff)) {
    return NextResponse.json({ error: "この操作を行う権限がありません" }, { status: 403 });
  }

  await recordAuditLog({ staffId: staff.id, action: "export", targetType: "offers" });

  const { searchParams } = new URL(request.url);
  const selections = await getOfferAndAcceptanceSelections({
    positionType: restrictedPositionType(staff),
    from: parseFromDate(searchParams.get("from") ?? undefined),
    to: parseToDate(searchParams.get("to") ?? undefined),
  });
  const rows = selections.map((selection) => ({
    last_name: selection.applicant.last_name,
    first_name: selection.applicant.first_name,
    email: selection.applicant.email,
    school: selection.applicant.school?.name ?? "",
    stage: selection.current_stage.name,
    assignee: selection.assignee?.name ?? "",
  }));

  const csv = toCsv(rows, [
    { key: "last_name", label: "姓" },
    { key: "first_name", label: "名" },
    { key: "email", label: "メールアドレス" },
    { key: "school", label: "学校" },
    { key: "stage", label: "ステージ" },
    { key: "assignee", label: "担当者" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="offers_${Date.now()}.csv"`,
    },
  });
}
