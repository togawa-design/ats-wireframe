// ローカル開発用の初期データ投入。本番(Cloud SQL)への投入は別途レビューの上で実行する。
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

const REQUIRED_MEDIA: { name: string; sync_type: "csv" | "api"; cost?: number }[] = [
  { name: "マイナビ", sync_type: "csv" },
  { name: "Re就活キャンパス", sync_type: "csv" },
  { name: "OfferBox", sync_type: "csv" },
  { name: "キミスカ", sync_type: "csv" },
  { name: "キャリアチケット", sync_type: "csv" },
  { name: "ABABA", sync_type: "csv" },
];

async function main() {
  // STEP 0: 最初の管理者アカウント。
  // google_id はログイン時に Firebase の uid へ自動同期されるため、初期値はプレースホルダー。
  const admin = await prisma.staff.upsert({
    where: { email: "t.ogawa@obt-llc.com" },
    update: {},
    create: {
      name: "小川拓也",
      email: "t.ogawa@obt-llc.com",
      google_id: "pending:t.ogawa@obt-llc.com",
      role: "admin",
      position_type_access: "both",
    },
  });
  console.log(`Staff ready: ${admin.email}`);

  // STEP 1: マスターデータ
  for (const media of REQUIRED_MEDIA) {
    await prisma.media.upsert({
      where: { name: media.name },
      update: {},
      create: { ...media, field_mapping: {} },
    });
  }
  console.log(`Media ready: ${REQUIRED_MEDIA.length} records`);

  const defaultFlowName = "2027年度 新卒採用";
  const existingFlow = await prisma.selectionFlow.findFirst({
    where: { name: defaultFlowName },
  });
  if (!existingFlow) {
    await prisma.selectionFlow.create({
      data: {
        name: defaultFlowName,
        is_default: true,
        is_active: true,
        stages: {
          create: [
            { name: "エントリー", order: 1, stage_type: "entry" },
            { name: "書類選考", order: 2, stage_type: "screening" },
            { name: "1次面接", order: 3, stage_type: "interview_1st" },
            { name: "2次面接", order: 4, stage_type: "interview_2nd" },
            { name: "最終面接", order: 5, stage_type: "interview_final" },
            { name: "内定", order: 6, stage_type: "offer" },
            { name: "内定承諾", order: 7, stage_type: "acceptance" },
          ],
        },
      },
    });
    console.log(`SelectionFlow ready: ${defaultFlowName}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
