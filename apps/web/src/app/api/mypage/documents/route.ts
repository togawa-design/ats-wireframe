import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApplicantFromRequest } from "@/lib/mypage-auth";
import { uploadApplicantFile } from "@/lib/firebase/storage";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES: Record<"resume" | "photo", string[]> = {
  resume: ["application/pdf"],
  photo: ["image/jpeg"],
};

/** FR002: マイページからの書類(エントリーシート)・証明写真アップロード。 */
export async function POST(request: Request) {
  const applicant = await getApplicantFromRequest(request);
  if (!applicant) {
    return NextResponse.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  const formData = await request.formData();
  const kind = String(formData.get("kind") ?? "");
  const file = formData.get("file");

  if (kind !== "resume" && kind !== "photo") {
    return NextResponse.json({ error: "kindが不正です" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "ファイルを選択してください" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "ファイルサイズは5MB以下にしてください" }, { status: 400 });
  }
  if (!ALLOWED_CONTENT_TYPES[kind].includes(file.type)) {
    return NextResponse.json(
      { error: kind === "resume" ? "PDFファイルを選択してください" : "JPG画像を選択してください" },
      { status: 400 }
    );
  }

  const url = await uploadApplicantFile(applicant.id, kind, file);

  await prisma.applicant.update({
    where: { id: applicant.id },
    data: kind === "resume" ? { resume_url: url } : { photo_url: url },
  });

  return NextResponse.json({ url });
}
