import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { LogoutButton } from "@/components/logout-button";

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  recruiter: "採用担当",
  interviewer: "面接官",
  viewer: "閲覧者",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getCurrentStaff();
  if (!staff) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <div className="text-sm text-muted-foreground">
            {staff.name}
            <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
              {ROLE_LABELS[staff.role] ?? staff.role}
            </span>
          </div>
          <LogoutButton />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
