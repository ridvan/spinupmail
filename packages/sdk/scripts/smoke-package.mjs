import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");

const run = (command, args, cwd = packageRoot) => {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
  });
};

const cleanupPaths = [];

try {
  run("pnpm", ["exec", "tsdown", "--config", "tsdown.config.ts"]);

  const packDestination = fs.mkdtempSync(
    path.join(os.tmpdir(), "spinupmail-pack-")
  );
  cleanupPaths.push(packDestination);
  run("pnpm", ["pack", "--pack-destination", packDestination]);

  const tarballs = fs
    .readdirSync(packDestination)
    .filter(name => name.endsWith(".tgz"));

  if (tarballs.length === 0) {
    throw new Error("pnpm pack did not produce a tarball.");
  }

  const tarballPath = path.join(packDestination, tarballs[0]);
  const extractionDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "spinupmail-unpack-")
  );
  cleanupPaths.push(extractionDir);
  run("tar", ["-xzf", tarballPath, "-C", extractionDir]);

  const extractedPackageRoot = path.join(extractionDir, "package");
  const extractedDistRoot = path.join(extractedPackageRoot, "dist");
  const extractedNodeModules = path.join(extractedPackageRoot, "node_modules");
  fs.mkdirSync(extractedNodeModules, { recursive: true });
  fs.symlinkSync(
    path.join(packageRoot, "node_modules", "zod"),
    path.join(extractedNodeModules, "zod"),
    "dir"
  );

  const esmCheckPath = path.join(packDestination, "esm-check.mjs");
  fs.writeFileSync(
    esmCheckPath,
    `import { SpinupMail } from ${JSON.stringify(
      path.join(extractedDistRoot, "index.mjs")
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
      path.join(extractedDistRoot, "index.cjs")
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
  cleanupPaths.push(tsConsumerDir);
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
            spinupmail: [extractedPackageRoot],
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
} finally {
  for (const cleanupPath of cleanupPaths.reverse()) {
    fs.rmSync(cleanupPath, { recursive: true, force: true });
  }
}
