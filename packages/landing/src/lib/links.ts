const FALLBACK_GITHUB_URL = "https://github.com/ridvan/spinupmail";
const FALLBACK_DOCS_URL = `${FALLBACK_GITHUB_URL}#readme`;
const FALLBACK_APP_URL = "https://app.spinupmail.com";

const normalizeUrl = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
};

const github =
  normalizeUrl(import.meta.env.VITE_GITHUB_URL) ?? FALLBACK_GITHUB_URL;
const docs = normalizeUrl(import.meta.env.VITE_DOCS_URL) ?? FALLBACK_DOCS_URL;
const app = normalizeUrl(import.meta.env.VITE_APP_URL) ?? FALLBACK_APP_URL;

export const landingLinks = {
  github,
  docs,
  app,
  quickstart: `${docs}#1-install-dependencies`,
  apiDocs: `${docs}#api-usage-automation`,
  deployBackend: `${docs}#5-deploy-the-backend-worker`,
  deployFrontend: `${docs}#7-deploy-the-frontend-cloudflare-pages`,
} as const;
