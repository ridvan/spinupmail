import { defineConfig } from "vitest/config";
import mdx from "@mdx-js/rollup";
import rehypePrettyCode from "rehype-pretty-code";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import viteTsConfigPaths from "vite-tsconfig-paths";

const mdxPlugin = mdx({
  remarkPlugins: [remarkGfm],
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
