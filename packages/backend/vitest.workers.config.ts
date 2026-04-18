import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const { cloudflareTest } = await import("@cloudflare/vitest-pool-workers");

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      cloudflareTest({
        wrangler: {
          configPath: "./wrangler.toml",
        },
      }),
    ],
    test: {
      include: ["tests/integration/**/*.workers.test.ts"],
      globals: true,
    },
  };
});
