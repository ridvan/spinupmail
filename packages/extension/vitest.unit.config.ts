import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "jsdom",
    globals: true,
  },
});
