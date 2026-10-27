import "server-only";
import { getStorage } from "firebase-admin/storage";
import { adminApp } from "./admin";

function getBucket() {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ??
    `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`;
  return getStorage(adminApp).bucket(bucketName);
}

async function uploadBuffer(path: string, buffer: Buffer, contentType: string): Promise<string> {
  const bucket = getBucket();
  const storageFile = bucket.file(path);
  await storageFile.save(buffer, { contentType });
  await storageFile.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}

/** 応募者の書類・画像をFirebase Storageにアップロードし、公開URLを返す(FR002)。 */
export async function uploadApplicantFile(
  applicantId: string,
  kind: "resume" | "photo",
  file: File
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `applicants/${applicantId}/${kind}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadBuffer(path, buffer, file.type || "application/octet-stream");
}

/** LINEメッセージの画像(送信・受信双方)をFirebase Storageにアップロードし、公開URLを返す(FR032)。 */
export async function uploadLineMessageImage(
  applicantId: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `line-messages/${applicantId}/${Date.now()}.${ext}`;
  return uploadBuffer(path, buffer, contentType);
}

/** リッチメニュー画像をFirebase Storageに保管し、公開URLを返す(FR034、管理画面でのプレビュー用)。 */
export async function uploadRichMenuImage(
  richMenuId: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const ext = contentType.includes("png") ? "png" : "jpg";
  const path = `rich-menus/${richMenuId}/${Date.now()}.${ext}`;
  return uploadBuffer(path, buffer, contentType);
}
