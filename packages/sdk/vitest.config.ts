import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/app\//,
        replacement: `${path.resolve(__dirname, "../backend/src/app")}/`,
      },
      {
        find: /^@\/modules\//,
        replacement: `${path.resolve(__dirname, "../backend/src/modules")}/`,
      },
      {
        find: /^@\/platform\//,
        replacement: `${path.resolve(__dirname, "../backend/src/platform")}/`,
      },
      {
        find: /^@\/db$/,
        replacement: path.resolve(__dirname, "../backend/src/db/index.ts"),
      },
      {
        find: /^@\/shared\//,
        replacement: `${path.resolve(__dirname, "../backend/src/shared")}/`,
      },
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, "./src")}/`,
      },
      {
        find: "cloudflare:workers",
        replacement: path.resolve(
          __dirname,
          "../backend/tests/fixtures/cloudflare-workers-shim.ts"
        ),
      },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: true,
    restoreMocks: true,
  },
});
