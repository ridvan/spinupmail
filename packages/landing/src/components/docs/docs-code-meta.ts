function normalizeLanguage(language: string): string {
  return language.trim().toLowerCase();
}

const LANGUAGE_LABELS: Record<string, string> = {
  bash: "Bash",
  shell: "Bash",
  sh: "Bash",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  dotenv: "Dotenv",
  env: "Dotenv",
  text: "Text",
  txt: "Text",
  plaintext: "Text",
  md: "Markdown",
  markdown: "Markdown",
  js: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  tsx: "TSX",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
};

export function formatCodeLanguageLabel(language: string): string {
  const normalized = normalizeLanguage(language);
  const directLabel = LANGUAGE_LABELS[normalized];

  if (directLabel) {
    return directLabel;
  }

  const words = normalized
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map(segment => segment[0].toUpperCase() + segment.slice(1));

  return words.join(" ") || "Text";
}

export function inferMdxCodeTitle(language: string, code: string): string {
  const normalized = normalizeLanguage(language);

  if (normalized === "bash" || normalized === "shell" || normalized === "sh") {
    if (/\bcurl\b/.test(code)) {
      return "HTTP request example";
    }

    if (/\b(pnpm|npm|yarn|bun|npx|pnpx|wrangler)\b/.test(code)) {
      return "CLI command example";
    }

    return "Shell command example";
  }

  if (normalized === "dotenv" || normalized === "env") {
    return "Environment variables";
  }

  if (normalized === "toml") {
    return "Configuration example";
  }

  if (normalized === "yaml" || normalized === "yml") {
    return "YAML configuration example";
  }

  if (normalized === "json") {
    if (/"error"\s*:/.test(code)) {
      return "JSON error response";
    }

    return "JSON response example";
  }

  if (
    normalized === "text" ||
    normalized === "txt" ||
    normalized === "plaintext"
  ) {
    return "Text output example";
  }

  return `${formatCodeLanguageLabel(language)} example`;
}
