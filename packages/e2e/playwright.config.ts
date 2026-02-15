import { defineConfig, devices } from "@playwright/test";

const runE2E = process.env.RUN_E2E !== "0";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: runE2E
    ? [
        {
          command: "pnpm -C ../backend dev --ip 127.0.0.1 --port 8787",
          url: "http://127.0.0.1:8787/health",
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
          env: {
            BETTER_AUTH_SECRET: "test-secret-for-e2e",
            BETTER_AUTH_BASE_URL: "http://127.0.0.1:8787/api/auth",
            TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
            RESEND_API_KEY: "re_test_key",
          },
        },
        {
          command: "pnpm -C ../frontend dev --host 127.0.0.1 --port 5173",
          url: "http://127.0.0.1:5173/sign-in",
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
        },
      ]
    : undefined,
});
