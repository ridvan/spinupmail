import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import mdx from "@mdx-js/rollup";
import rehypePrettyCode from "rehype-pretty-code";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

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

const config = defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    devtools(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    mdxPlugin,
    tanstackStart(),
    viteReact({
      include: /\.(mdx|js|jsx|ts|tsx)$/,
    }),
  ],
});

export default config;
