import "server-only";
import { prisma } from "@/lib/prisma";
import { verifyLiffIdToken } from "@/lib/line/verify-id-token";

/** マイページAPIのリクエストから、Authorization: Bearer <LIFF ID Token> を検証して応募者を取得する。 */
export async function getApplicantFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!idToken) return null;

  let lineUserId: string;
  try {
    lineUserId = await verifyLiffIdToken(idToken);
  } catch {
    return null;
  }

  return prisma.applicant.findUnique({
    where: { line_user_id: lineUserId },
    include: {
      school: true,
      selection: {
        include: {
          current_stage: true,
          flow: { include: { stages: { orderBy: { order: "asc" } } } },
        },
      },
    },
  });
}
