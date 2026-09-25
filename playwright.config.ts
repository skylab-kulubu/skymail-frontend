import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT, E2E_SERVER_ENV } from "./tests/e2e/fixtures/env";

/**
 * Browser tests for the riskiest flows (spec, Testing Decisions boundary 3):
 * the panel runs as a production build, the SkyMail API is mocked at the
 * network layer, and sessions are minted rather than signed in. Run with
 * `yarn test:e2e`; the first run builds the panel.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: E2E_BASE_URL,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node .yarn/releases/yarn-4.14.1.cjs build && node .yarn/releases/yarn-4.14.1.cjs start --port ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/login`,
    env: E2E_SERVER_ENV,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
