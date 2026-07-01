import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit/integration tests live in tests/ (excluding e2e, which Playwright runs).
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "node",
    passWithNoTests: true,
  },
});
