import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import mdx from "@mdx-js/rollup";
import rehypePrettyCode from "rehype-pretty-code";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import rehypeSlug from "rehype-slug";
import viteTsConfigPaths from "vite-tsconfig-paths";

const DOCS_DIR = join(fileURLToPath(import.meta.url), "../src/content/docs");

function docsMarkdownPlugin() {
  const virtualId = "virtual:docs-markdown";
  const resolvedId = "\0" + virtualId;

  return {
    name: "vitest-plugin-docs-markdown",
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    async load(id) {
      if (id !== resolvedId) return;
      const files = await readdir(DOCS_DIR);
      const entries = {};
      for (const file of files) {
        if (!file.endsWith(".mdx")) continue;
        const slug = file.replace(".mdx", "");
        const filePath = join(DOCS_DIR, file);
        this.addWatchFile(filePath);
        const raw = await readFile(filePath, "utf-8");
        entries[slug] = raw.replace(/^---[\s\S]*?---\s*/, "").trim();
      }
      return `export default ${JSON.stringify(entries)}`;
    },
  };
}

const mdxPlugin = mdx({
  remarkPlugins: [
    remarkFrontmatter,
    [remarkMdxFrontmatter, { name: "meta" }],
    remarkGfm,
  ],
  rehypePlugins: [
    rehypeSlug,
    [
      rehypePrettyCode,
      {
        keepBackground: false,
        defaultLang: {
          block: "txt",
          inline: "txt",
        },
        theme: {
          dark: "one-dark-pro",
          light: "github-light",
        },
        onVisitLine(/** @type {{ children: Array<unknown> }} */ node) {
          if (node.children.length === 0) {
            node.children = [{ type: "text", value: " " }];
          }
        },
        onVisitHighlightedLine(
          /** @type {{ properties: { className?: Array<string> } }} */ node
        ) {
          node.properties.className ??= [];
          node.properties.className.push("docs-highlighted-line");
        },
        onVisitHighlightedWord(
          /** @type {{ properties: { className?: Array<string> } }} */ node
        ) {
          node.properties.className = ["docs-highlighted-word"];
        },
      },
    ],
  ],
});
mdxPlugin.enforce = "pre";

export default defineConfig({
  plugins: [
    docsMarkdownPlugin(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    mdxPlugin,
  ],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
