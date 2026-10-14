import "server-only";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from "./admin";

function getBucket() {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ??
    `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`;
  return getStorage(adminApp).bucket(bucketName);
}

/** 応募者の書類・画像をFirebase Storageにアップロードし、公開URLを返す(FR002)。 */
export async function uploadApplicantFile(
  applicantId: string,
  kind: "resume" | "photo",
  file: File
): Promise<string> {
  const bucket = getBucket();
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `applicants/${applicantId}/${kind}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const storageFile = bucket.file(path);
  await storageFile.save(buffer, {
    contentType: file.type || "application/octet-stream",
  });
  await storageFile.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}
