import { defineConfig, devices } from "@playwright/test";

import { APP_PORT, FIXTURE_PORT } from "./tests/e2e/constants";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/fixture-server.mjs",
      port: FIXTURE_PORT,
      reuseExistingServer: false,
      env: { FIXTURE_PORT: String(FIXTURE_PORT) },
    },
    {
      command: `npm run start -- --port ${APP_PORT}`,
      port: APP_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_DIR: "memory",
        LEAKFIX_ALLOW_PRIVATE_TARGETS: "true",
      },
    },
  ],
});
