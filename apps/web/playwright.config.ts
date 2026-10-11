import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { AUTH_STATE_PATH } from "./e2e/global-setup";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // e2e/*.spec.ts(機能ごとのハッピーパス) と e2e/scenarios/*.spec.ts(複数機能を
  // またぐ業務フローのシナリオテスト)の両方を拾う。
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  globalSetup: path.join(__dirname, "e2e/global-setup.ts"),
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_STATE_PATH,
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5433/ats_e2e?schema=public",
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "localhost:9099",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "fujiarte-ats-e2e",
    },
  },
});
