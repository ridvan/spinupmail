import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "cloudflare:workers": path.resolve(
        __dirname,
        "./tests/fixtures/cloudflare-workers-shim.ts"
      ),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["tests/integration/**/*.workers.test.ts"],
    environment: "node",
    globals: true,
    setupFiles: ["tests/fixtures/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage/integration",
      include: [
        "src/modules/inbound-email/handler.ts",
        "src/modules/inbound-email/parser.ts",
        "src/modules/emails/service.ts",
        "src/modules/auth-http/service.ts",
        "src/app/middleware/require-organization-scope.ts",
      ],
      thresholds: {
        lines: 85,
      },
    },
  },
});
