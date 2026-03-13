import { randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { e2eAuthBaseUrl, e2eBackendBaseUrl } from "./tests/helpers/e2e-urls";

const runE2E = process.env.RUN_E2E !== "0";
const e2eTestSecret = process.env.E2E_TEST_SECRET ?? randomUUID();
const turnstileSiteKey = "1x00000000000000000000AA";
const turnstileSecretKey = "1x0000000000000000000000000000000AA";
const betterAuthSecret = "spinupmail-e2e-better-auth-secret";

process.env.E2E_TEST_SECRET = e2eTestSecret;

const backendCommand =
  `pnpm -C ../backend run db:migrate:e2e && ` +
  `pnpm -C ../backend exec wrangler dev --config wrangler.e2e.toml ` +
  `--ip 127.0.0.1 --port ${new URL(e2eBackendBaseUrl).port} --var E2E_TEST_SECRET:${e2eTestSecret} ` +
  `--var TURNSTILE_SECRET_KEY:${turnstileSecretKey} ` +
  `--var BETTER_AUTH_SECRET:${betterAuthSecret} ` +
  `--var BETTER_AUTH_BASE_URL:${e2eAuthBaseUrl}`;
const frontendCommand = process.env.CI
  ? "pnpm -C ../frontend build && pnpm -C ../frontend exec vite preview --host 127.0.0.1 --port 5173 --strictPort"
  : "pnpm -C ../frontend dev --host 127.0.0.1 --port 5173";

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
          command: backendCommand,
          url: `${e2eBackendBaseUrl}/health`,
          timeout: 120_000,
          reuseExistingServer: false,
        },
        {
          command: frontendCommand,
          url: "http://127.0.0.1:5173/sign-in",
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
          env: {
            VITE_API_BASE_URL: e2eBackendBaseUrl,
            VITE_AUTH_BASE_URL: e2eAuthBaseUrl,
            VITE_TURNSTILE_SITE_KEY: turnstileSiteKey,
          },
        },
      ]
    : undefined,
});
