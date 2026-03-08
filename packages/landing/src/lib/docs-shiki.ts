import type { HighlighterCore } from "shiki/dist/types.mjs";

const SUPPORTED_DOCS_LANGS = new Set([
  "bash",
  "dotenv",
  "json",
  "toml",
  "text",
]);

let docsHighlighterPromise: Promise<HighlighterCore> | null = null;

export function normalizeDocsLanguage(language: string): string {
  const normalized = language.toLowerCase();

  switch (normalized) {
    case "shell":
    case "sh":
      return "bash";
    case "env":
      return "dotenv";
    case "plaintext":
    case "txt":
      return "text";
    default:
      return SUPPORTED_DOCS_LANGS.has(normalized) ? normalized : "text";
  }
}

export function getDocsTheme(
  isDark: boolean
): "tokyo-night" | "github-light-default" {
  return isDark ? "tokyo-night" : "github-light-default";
}

export async function getDocsHighlighter(): Promise<HighlighterCore> {
  if (!docsHighlighterPromise) {
    docsHighlighterPromise = (async () => {
      const [
        { createHighlighterCore },
        { createJavaScriptRegexEngine },
        { default: bash },
        { default: dotenv },
        { default: json },
        { default: toml },
        { default: githubLightDefault },
        { default: tokyoNight },
      ] = await Promise.all([
        import("shiki/dist/core.mjs"),
        import("shiki/dist/engine-javascript.mjs"),
        import("shiki/dist/langs/bash.mjs"),
        import("shiki/dist/langs/dotenv.mjs"),
        import("shiki/dist/langs/json.mjs"),
        import("shiki/dist/langs/toml.mjs"),
        import("shiki/dist/themes/github-light-default.mjs"),
        import("shiki/dist/themes/tokyo-night.mjs"),
      ]);

      return createHighlighterCore({
        engine: createJavaScriptRegexEngine(),
        langs: [bash, dotenv, json, toml],
        themes: [githubLightDefault, tokyoNight],
      });
    })();
  }

  return docsHighlighterPromise;
}
