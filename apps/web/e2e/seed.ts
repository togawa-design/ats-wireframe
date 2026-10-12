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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
