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
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    globals: true,
    setupFiles: ["tests/fixtures/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage/unit",
      include: ["src/**/*.ts"],
      exclude: ["src/db/**", "src/env.d.ts", "src/auth/**", "src/index.ts"],
      thresholds: {
        lines: 80,
        branches: 70,
      },
    },
  },
});
