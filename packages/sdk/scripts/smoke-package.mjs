import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const distRoot = path.join(packageRoot, "dist");

const run = (command, args, cwd = packageRoot) => {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
  });
};

run("pnpm", ["exec", "tsdown", "--config", "tsdown.config.ts"]);

const packDestination = fs.mkdtempSync(
  path.join(os.tmpdir(), "spinupmail-pack-")
);
run("pnpm", ["pack", "--pack-destination", packDestination]);

const tarballs = fs
  .readdirSync(packDestination)
  .filter(name => name.endsWith(".tgz"));

if (tarballs.length === 0) {
  throw new Error("pnpm pack did not produce a tarball.");
}

const esmCheckPath = path.join(packDestination, "esm-check.mjs");
fs.writeFileSync(
  esmCheckPath,
  `import { SpinupMail } from ${JSON.stringify(
    path.join(distRoot, "index.mjs")
  )};
if (typeof SpinupMail !== "function") {
  throw new Error("ESM build did not export SpinupMail.");
}
`
);
run("node", [esmCheckPath], packDestination);

const cjsCheckPath = path.join(packDestination, "cjs-check.cjs");
fs.writeFileSync(
  cjsCheckPath,
  `const { SpinupMail } = require(${JSON.stringify(
    path.join(distRoot, "index.cjs")
  )});
if (typeof SpinupMail !== "function") {
  throw new Error("CJS build did not export SpinupMail.");
}
`
);
run("node", [cjsCheckPath], packDestination);

const tsConsumerDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "spinupmail-ts-consumer-")
);
fs.writeFileSync(
  path.join(tsConsumerDir, "index.ts"),
  `import { SpinupMail } from "spinupmail";

const spinupmail = new SpinupMail({
  apiKey: "spin_test",
  organizationId: "org-1",
});

void spinupmail.domains.get();
`
);
fs.writeFileSync(
  path.join(tsConsumerDir, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        noEmit: true,
        baseUrl: ".",
        paths: {
          spinupmail: [packageRoot],
        },
      },
      include: ["./index.ts"],
    },
    null,
    2
  )
);
run("pnpm", [
  "exec",
  "tsc",
  "--project",
  path.join(tsConsumerDir, "tsconfig.json"),
]);
