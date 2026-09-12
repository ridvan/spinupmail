import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { format } from "prettier";
import {
  createAgentLlmsText,
  generateAgentOpenApiJson,
} from "../src/agent-openapi";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const output = path.join(root, "docs/api");
const files = [
  [
    "v1-openapi.json",
    await format(generateAgentOpenApiJson(), { parser: "json" }),
  ],
  ["llms.txt", createAgentLlmsText()],
] as const;

if (process.argv.includes("--check")) {
  const mismatches: string[] = [];
  for (const [name, expected] of files) {
    const actual = await readFile(path.join(output, name), "utf8").catch(
      () => ""
    );
    if (actual !== expected) mismatches.push(name);
  }
  if (mismatches.length) {
    throw new Error(
      `Generated agent contracts are stale: ${mismatches.join(", ")}`
    );
  }
  process.exit(0);
}

await mkdir(output, { recursive: true });
await Promise.all(
  files.map(([name, contents]) => writeFile(path.join(output, name), contents))
);
