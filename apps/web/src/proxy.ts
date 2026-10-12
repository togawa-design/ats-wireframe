import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

// Next.js 16: `middleware.ts`/`middleware()` は `proxy.ts`/`proxy()` に改名された。
// ここではCookieの有無だけを見る軽量チェックに留め、トークンの正式な検証と
// Staffレコードの照合は各ページ(server component)側の getCurrentStaff() で行う
// (Firebase Admin SDKでの検証をリクエストのたびに二重で行わないため)。
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
