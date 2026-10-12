// E2E専用の最小シード。テスト用Staff以外のマスターデータは各specが必要に応じて作る。
import { PrismaClient } from "../src/generated/prisma/client";
import { E2E_STAFF_EMAIL } from "./global-setup";

const prisma = new PrismaClient();

async function main() {
  await prisma.staff.upsert({
    where: { email: E2E_STAFF_EMAIL },
    update: {},
    create: {
      name: "E2Eテストスタッフ",
      email: E2E_STAFF_EMAIL,
      google_id: "pending:e2e",
      role: "admin",
      position_type_access: "both",
    },
  });

  // 応募者登録時にSelectionを自動作成するため、デフォルト選考フローが必要。
  const defaultFlowName = "E2Eテストフロー";
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
          ],
        },
      },
    });
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
