import "server-only";
import { cookies } from "next/headers";
import { verifySessionCookie, SESSION_COOKIE_NAME } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";

/** 現在のセッションCookieから Staff を取得する。未ログイン/無効なら null。 */
export async function getCurrentStaff() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await verifySessionCookie(sessionCookie);
    if (!decoded.email) return null;
    const staff = await prisma.staff.findUnique({ where: { email: decoded.email } });
    if (!staff || !staff.is_active) return null;
    return staff;
  } catch {
    return null;
  }
}
