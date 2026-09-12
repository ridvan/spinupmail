import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/agent-client.ts",
    "src/cli.ts",
    "src/mcp.ts",
    "src/mcp-server.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  outDir: "dist",
  deps: {
    neverBundle: ["zod"],
  },
});
