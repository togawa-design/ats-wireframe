import { beforeEach, vi } from "vitest";
import { mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";

// "server-only" はNextのバンドラ経由でのみ no-op になるパッケージで、Vitest(素のNode)から
// 読み込むと常に例外を投げる。ユニットテストではその保護は不要なので無効化する。
vi.mock("server-only", () => ({}));

// 各テストファイル側で `vi.mock("@/lib/prisma", () => ({ prisma: mockDeep<PrismaClient>() }))`
// を呼んでいる前提(そのテストファイルが./actionsなどを静的importする前に登録される必要が
// あるため、vi.mockはここではなく各テストファイルに書く)。
// ここではテストごとの状態リセットだけを共通化する。動的importにしているのは、
// beforeEach実行時(=テストファイルのvi.mock登録が済んだ後)に解決させるため。
beforeEach(async () => {
  // @/lib/prisma をモックしていないテストファイル(例: LINEクライアントの単体テスト)も
  // あるため、実際にモックが登録されている場合だけリセットする。
  const { prisma } = await import("@/lib/prisma");
  const maybeMock = prisma as unknown as DeepMockProxy<PrismaClient>;
  if (typeof maybeMock.$transaction === "function" && "mockReset" in maybeMock.$transaction) {
    mockReset(maybeMock);
  }
});
