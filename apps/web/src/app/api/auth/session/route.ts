import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  adminAuth,
  createSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRES_IN_MS,
} from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";

/**
 * ブラウザでの Google OAuth (Firebase Auth) 完了後に呼ばれる。
 * ID トークンを検証し、事前に登録済みの Staff（email一致）であることを確認してから
 * セッションCookieを発行する。Staffレコードの新規作成（自己登録）はしない —
 * 担当者アカウントは管理者が事前に登録する運用（architecture.html参照）。
 */
export async function POST(request: Request) {
  const { idToken } = (await request.json()) as { idToken?: string };
  if (!idToken) {
    return NextResponse.json({ error: "idToken is required" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "invalid idToken" }, { status: 401 });
  }

  if (!decoded.email) {
    return NextResponse.json({ error: "email not present on token" }, { status: 401 });
  }

  const staff = await prisma.staff.findUnique({ where: { email: decoded.email } });
  if (!staff || !staff.is_active) {
    return NextResponse.json(
      { error: "このメールアドレスは担当者として登録されていません" },
      { status: 403 }
    );
  }

  // 初回ログイン時（または google_id 未同期時）に Firebase の uid を同期する。
  // Staffレコード自体は管理者がemailで事前作成する運用のため、ここでの更新は
  // 「どのGoogleアカウントでログインしたか」の追跡用。
  if (staff.google_id !== decoded.uid) {
    await prisma.staff.update({
      where: { id: staff.id },
      data: { google_id: decoded.uid },
    });
  }

  const sessionCookie = await createSessionCookie(idToken);
  const ipAddress =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  await prisma.auditLog.create({
    data: {
      staff_id: staff.id,
      action: "login",
      ip_address: ipAddress,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_EXPIRES_IN_MS / 1000,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
