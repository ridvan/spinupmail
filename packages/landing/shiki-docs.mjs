import { createHighlighterCore } from "shiki/dist/core.mjs";
import { createJavaScriptRegexEngine } from "shiki/dist/engine-javascript.mjs";
import bash from "shiki/dist/langs/bash.mjs";
import dotenv from "shiki/dist/langs/dotenv.mjs";
import json from "shiki/dist/langs/json.mjs";
import toml from "shiki/dist/langs/toml.mjs";
import githubLightDefault from "shiki/dist/themes/github-light-default.mjs";
import tokyoNight from "shiki/dist/themes/tokyo-night.mjs";

const DOCS_LANGS = [bash, dotenv, json, toml];
const DOCS_THEMES = [githubLightDefault, tokyoNight];
const SUPPORTED_DOCS_LANGS = new Set([
  "bash",
  "dotenv",
  "json",
  "toml",
  "text",
]);

let docsHighlighterPromise;

export function normalizeDocsLanguage(language) {
  const normalized = String(language || "text").toLowerCase();

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

export function getDocsHighlighter() {
  if (!docsHighlighterPromise) {
    docsHighlighterPromise = createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      langs: DOCS_LANGS,
      themes: DOCS_THEMES,
    });
  }

  return docsHighlighterPromise;
}
