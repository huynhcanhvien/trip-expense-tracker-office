import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT } from "./tests/e2e/env";

// e2e runs against an isolated file DB + console email + local storage (see env.ts).
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // single worker: one shared file DB + dev server
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Build + prod start (not `next dev`) so e2e can run alongside the user's own
    // `next dev` — Next 16 forbids two `next dev` on one project, but dev + build
    // use separate output dirs and coexist.
    command: `next build && next start -p ${E2E_PORT}`,
    port: E2E_PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL!,
      AUTH_SECRET: process.env.AUTH_SECRET!,
      AUTH_URL: process.env.AUTH_URL!,
      EMAIL_ADAPTER: "console",
      STORAGE_ADAPTER: "local",
      UPLOADS_DIR: process.env.UPLOADS_DIR!,
    },
  },
});
