import { beforeEach } from "vitest";
import { mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";

// 各テストファイル側で `vi.mock("@/lib/prisma", () => ({ prisma: mockDeep<PrismaClient>() }))`
// を呼んでいる前提(そのテストファイルが./actionsなどを静的importする前に登録される必要が
// あるため、vi.mockはここではなく各テストファイルに書く)。
// ここではテストごとの状態リセットだけを共通化する。動的importにしているのは、
// beforeEach実行時(=テストファイルのvi.mock登録が済んだ後)に解決させるため。
beforeEach(async () => {
  const { prisma } = await import("@/lib/prisma");
  mockReset(prisma as unknown as DeepMockProxy<PrismaClient>);
});
