import { defineConfig, devices } from "@playwright/test";
import { installedChromium } from "./scripts/browser.mjs";

try {
  process.loadEnvFile(".env.test.local");
} catch {
  /* setup-only smoke tests need no credentials */
}
process.env.APP_URL = "http://localhost:3100";

const executablePath = installedChromium();

export default defineConfig({
  testDir: "tests/e2e-office",
  globalSetup: "./tests/e2e-office/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    port: 3100,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      E2E_TEST: "1",
      APP_URL: "http://localhost:3100",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || "",
      GROQ_API_KEY: "e2e-mock-key",
      GROQ_API_URL: "http://127.0.0.1:3101/openai/v1/chat/completions",
    },
  },
});
