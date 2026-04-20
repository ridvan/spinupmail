import docsMarkdown from "virtual:docs-markdown";
import { docsOrderedSlugs } from "./docs-nav";
import type { ComponentType } from "react";

export type DocGroupId =
  | "get-started"
  | "api-reference"
  | "configuration"
  | "operations";

export type DocHeading = {
  id: string;
  title: string;
  level: 2 | 3;
  href: string;
};

export type DocMeta = {
  title: string;
  description: string;
  summary: string;
  groupId: DocGroupId;
  keywords: Array<string>;
};

export type DocPage = DocMeta & {
  slug: string;
  headings: Array<DocHeading>;
  searchText: string;
  codeText: string;
  markdown: string;
  Content: ComponentType<{
    components?: Record<string, ComponentType<Record<string, unknown>>>;
  }>;
};

export type DocNavGroup = {
  id: DocGroupId;
  title: string;
  description: string;
  slugs: Array<string>;
};

type DocMdxModule = {
  default: ComponentType<{
    components?: Record<string, ComponentType<Record<string, unknown>>>;
  }>;
  meta: DocMeta;
};

type DocIndexItem = {
  headings: Array<{ id: string; title: string; level: 2 | 3 }>;
  searchText: string;
  codeText: string;
};

const DOC_INDEX: Partial<Record<string, DocIndexItem>> = {
  installation: {
    headings: [
      { id: "prerequisites", title: "Prerequisites", level: 2 },
      {
        id: "install-dependencies",
        title: "Install dependencies",
        level: 2,
      },
      {
        id: "configure-cloudflare-resources",
        title: "Configure Cloudflare resources",
        level: 2,
      },
      { id: "create-d1-database", title: "Create D1 database", level: 3 },
      { id: "create-kv-namespace", title: "Create KV namespace", level: 3 },
      { id: "create-r2-bucket", title: "Create R2 bucket", level: 3 },
      {
        id: "create-queue-integration-dispatches",
        title: "Create queue (integration dispatches)",
        level: 3,
      },
      { id: "durable-objects", title: "Durable objects", level: 3 },
      {
        id: "backend-environment-variables-and-secrets",
        title: "Backend environment variables and secrets",
        level: 2,
      },
      {
        id: "creating-turnstile-key",
        title: "Creating Turnstile key",
        level: 3,
      },
      {
        id: "add-domain-to-resend-and-get-api-key",
        title: "Add domain to Resend and get API key",
        level: 3,
      },
      { id: "google-oauth-setup", title: "Google OAuth setup", level: 3 },
      {
        id: "database-migrations",
        title: "Database migrations",
        level: 2,
      },
      {
        id: "deploy-the-backend-worker",
        title: "Deploy the backend worker",
        level: 2,
      },
      {
        id: "configure-email-routing",
        title: "Configure email routing",
        level: 2,
      },
      {
        id: "configure-custom-domain-for-worker-api",
        title: "Configure custom domain for Worker API",
        level: 2,
      },
      { id: "worker-config", title: "Worker config", level: 3 },
      { id: "ui-behavior", title: "UI behavior", level: 3 },
      { id: "deploy-the-frontend", title: "Deploy the frontend", level: 2 },
      {
        id: "local-environment-variables",
        title: "Local environment variables",
        level: 3,
      },
      {
        id: "set-up-frontend-custom-domain",
        title: "Set up frontend custom domain",
        level: 2,
      },
      { id: "api-usage", title: "API usage", level: 2 },
      { id: "local-development", title: "Local development", level: 2 },
      { id: "local-email-testing", title: "Local email testing", level: 2 },
      { id: "notes", title: "Notes", level: 2 },
    ],
    searchText:
      "Spinupmail installation Cloudflare Email Routing Workers Pages pnpm D1 KV R2 queues secrets migrations deploy API subdomain custom domain local development integration secret encryption key",
    codeText:
      "pnpm install pnpm exec wrangler d1 create SUM_DB pnpm exec wrangler kv namespace create SUM_KV pnpm exec wrangler r2 bucket create spinupmail-attachments pnpm wrangler queues create spinupmail-integration-dispatches pnpm exec wrangler secret put INTEGRATION_SECRET_ENCRYPTION_KEY pnpm -C packages/backend db:migrate:dev pnpm -C packages/backend deploy VITE_AUTH_BASE_URL VITE_API_BASE_URL VITE_TURNSTILE_SITE_KEY pnpm -C packages/backend dev pnpm -C packages/frontend dev",
  },
  "api-overview": {
    headings: [
      {
        id: "base-url-and-authentication",
        title: "Base URL and authentication",
        level: 2,
      },
      {
        id: "organization-scope-rules",
        title: "Organization scope rules",
        level: 2,
      },
      {
        id: "response-and-error-conventions",
        title: "Response and error conventions",
        level: 2,
      },
      {
        id: "health-check",
        title: "Health check",
        level: 2,
      },
      {
        id: "auth-endpoints-outside-this-reference",
        title: "Auth endpoints outside this reference",
        level: 2,
      },
    ],
    searchText:
      "API overview base URL dedicated API domain session cookie API key X-Org-Id health check Better Auth product API reference",
    codeText:
      "GET /health X-API-Key X-Org-Id /api/domains /api/organizations/stats /api/email-addresses /api/emails",
  },
  "api-domains": {
    headings: [
      {
        id: "list-configured-domains",
        title: "List configured domains",
        level: 2,
      },
    ],
    searchText:
      "domains endpoint default configured domain API auth required no organization scope",
    codeText: "GET /api/domains items default No email domains configured",
  },
  "api-organizations": {
    headings: [
      {
        id: "post-organization",
        title: "Create organization",
        level: 2,
      },
      {
        id: "list-organization-stats",
        title: "List organization stats",
        level: 2,
      },
      {
        id: "get-email-activity",
        title: "Get email activity",
        level: 2,
      },
      {
        id: "get-email-summary",
        title: "Get email summary",
        level: 2,
      },
    ],
    searchText:
      "organizations create organization stats email activity summary X-Org-Id timezone daily count attachment totals busiest inboxes starter inbox",
    codeText:
      "POST /api/organizations GET /api/organizations/stats GET /api/organizations/stats/email-activity GET /api/organizations/stats/email-summary invalid timezone",
  },
  "api-email-addresses": {
    headings: [
      {
        id: "list-email-addresses",
        title: "List email addresses",
        level: 2,
      },
      {
        id: "list-recent-address-activity",
        title: "List recent address activity",
        level: 2,
      },
      {
        id: "create-an-email-address",
        title: "Create an email address",
        level: 2,
      },
      {
        id: "get-email-address-detail",
        title: "Get an email address",
        level: 2,
      },
      {
        id: "update-an-email-address",
        title: "Update an email address",
        level: 2,
      },
      {
        id: "delete-an-email-address",
        title: "Delete an email address",
        level: 2,
      },
    ],
    searchText:
      "email addresses allowedFromDomains blockedSenderDomains inboundRatePolicy maxReceivedEmailCount maxReceivedEmailAction maxReceivedEmailsPerAddress maxReceivedEmailsPerOrganization ttl localPart acceptedRiskNotice recent activity cursor search integrationSubscriptions integrations email.received",
    codeText:
      "GET /api/email-addresses GET /api/email-addresses/recent-activity POST /api/email-addresses GET /api/email-addresses/:id PATCH /api/email-addresses/:id DELETE /api/email-addresses/:id integrationSubscriptions integrations",
  },
  "api-emails": {
    headings: [
      {
        id: "list-emails",
        title: "List emails",
        level: 2,
      },
      {
        id: "get-email-detail",
        title: "Get email detail",
        level: 2,
      },
      {
        id: "download-raw-email",
        title: "Download raw email",
        level: 2,
      },
      {
        id: "download-attachment",
        title: "Download attachment",
        level: 2,
      },
      {
        id: "delete-email",
        title: "Delete email",
        level: 2,
      },
    ],
    searchText:
      "emails address or addressId required search raw source not available attachment content not found raw download path senderLabel inline attachment",
    codeText:
      "GET /api/emails search GET /api/emails/:id GET /api/emails/:id/raw GET /api/emails/:id/attachments/:attachmentId inline DELETE /api/emails/:id",
  },
  "cloudflare-resources": {
    headings: [
      {
        id: "provision-the-required-resources",
        title: "Provision the required resources",
        level: 2,
      },
      {
        id: "copy-the-backend-wrangler-config",
        title: "Copy the backend Wrangler config",
        level: 2,
      },
      {
        id: "fill-the-worker-variables",
        title: "Fill the Worker variables",
        level: 2,
      },
      {
        id: "required-variables",
        title: "Required variables",
        level: 3,
      },
      {
        id: "common-optional-variables",
        title: "Common optional variables",
        level: 3,
      },
      {
        id: "domain-strategy-and-routing-prep",
        title: "Domain strategy and routing prep",
        level: 2,
      },
    ],
    searchText:
      "Cloudflare resources D1 KV R2 Queues Durable Objects wrangler bindings EMAIL_DOMAINS RESEND_FROM_EMAIL AUTH_ALLOWED_EMAIL_DOMAIN preview bucket integration dispatch",
    codeText:
      "pnpm exec wrangler d1 create SUM_DB pnpm exec wrangler kv namespace create SUM_KV pnpm exec wrangler r2 bucket create spinupmail-attachments spinupmail-attachments-preview pnpm wrangler queues create spinupmail-integration-dispatches wrangler.toml.example durable_objects ABUSE_COUNTERS",
  },
  "auth-secrets": {
    headings: [
      {
        id: "set-the-production-worker-secrets",
        title: "Set the production Worker secrets",
        level: 2,
      },
      {
        id: "add-local-development-secrets",
        title: "Add local development secrets",
        level: 2,
      },
      {
        id: "configure-turnstile-and-resend",
        title: "Configure Turnstile and Resend",
        level: 2,
      },
      {
        id: "turnstile",
        title: "Turnstile",
        level: 3,
      },
      {
        id: "resend",
        title: "Resend",
        level: 3,
      },
      {
        id: "configure-google-oauth-callbacks",
        title: "Configure Google OAuth callbacks",
        level: 2,
      },
      {
        id: "authorized-javascript-origins",
        title: "Authorized JavaScript origins",
        level: 3,
      },
      {
        id: "authorized-redirect-uris",
        title: "Authorized redirect URIs",
        level: 3,
      },
      {
        id: "optional-auth-domain-restriction",
        title: "Optional auth domain restriction",
        level: 2,
      },
    ],
    searchText:
      "Better Auth Google OAuth Resend Turnstile secrets CORS_ORIGIN BETTER_AUTH_BASE_URL INTEGRATION_SECRET_ENCRYPTION_KEY callbacks trusted origins dedicated API domain local dev",
    codeText:
      "BETTER_AUTH_SECRET BETTER_AUTH_BASE_URL INTEGRATION_SECRET_ENCRYPTION_KEY CORS_ORIGIN GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET RESEND_API_KEY TURNSTILE_SECRET_KEY VITE_TURNSTILE_SITE_KEY",
  },
  "deploy-routing": {
    headings: [
      {
        id: "deploy-the-backend-worker",
        title: "Deploy the backend Worker",
        level: 2,
      },
      {
        id: "deploy-the-frontend-pages-project",
        title: "Deploy the frontend Pages project",
        level: 2,
      },
      {
        id: "choose-your-api-routing-topology",
        title: "Choose your API routing topology",
        level: 2,
      },
      {
        id: "configure-inbound-email-routing",
        title: "Configure inbound email routing",
        level: 2,
      },
    ],
    searchText:
      "deploy Worker Pages custom domains dedicated API domain same host path based routing api email routing catch-all",
    codeText:
      "pnpm -C packages/backend deploy VITE_AUTH_BASE_URL VITE_API_BASE_URL VITE_TURNSTILE_SITE_KEY api.spinupmail.com /api/*",
  },
  "inbound-pipeline": {
    headings: [
      { id: "processing-flow", title: "Processing flow", level: 2 },
      { id: "storage-paths", title: "Storage paths", level: 2 },
    ],
    searchText:
      "inbound pipeline MIME parsing sanitization D1 R2 attachment path",
    codeText:
      "email-attachments/<organizationId>/<addressId>/<emailId>/<attachmentId>-<filename>",
  },
  "multi-domain": {
    headings: [
      { id: "worker-config", title: "Worker config", level: 2 },
      {
        id: "routing-rule-checklist",
        title: "Routing rule checklist",
        level: 2,
      },
      { id: "ui-behavior", title: "UI behavior", level: 2 },
    ],
    searchText: "multi-domain EMAIL_DOMAINS routing rules domain selector",
    codeText: "EMAIL_DOMAINS spinupmail.com spinuptestdomain.com",
  },
  "local-development": {
    headings: [
      { id: "run-locally", title: "Run locally", level: 2 },
      {
        id: "simulate-inbound-delivery",
        title: "Simulate inbound delivery",
        level: 2,
      },
    ],
    searchText: "local development wrangler dev .dev.vars simulation",
    codeText:
      "VITE_AUTH_BASE_URL VITE_API_BASE_URL VITE_TURNSTILE_SITE_KEY BETTER_AUTH_SECRET curl /cdn-cgi/handler/email",
  },
  "limits-security": {
    headings: [
      { id: "product-caps", title: "Product caps", level: 2 },
      {
        id: "email-and-attachment-limits",
        title: "Email and attachment limits",
        level: 2,
      },
      {
        id: "storage-and-raw-email-toggles",
        title: "Storage and raw email toggles",
        level: 2,
      },
      {
        id: "auth-and-api-rate-limits",
        title: "Auth and API rate limits",
        level: 2,
      },
      {
        id: "verification-resend-throttling",
        title: "Verification resend throttling",
        level: 3,
      },
      {
        id: "retrieval-boundaries",
        title: "Retrieval boundaries",
        level: 2,
      },
    ],
    searchText:
      "limits security organizations members addresses attachments raw email rate limiting verification resend X-Org-Id",
    codeText:
      "MAX_ADDRESSES_PER_ORGANIZATION EMAIL_MAX_BYTES EMAIL_BODY_MAX_BYTES EMAIL_ATTACHMENT_MAX_BYTES EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION EMAIL_ATTACHMENTS_ENABLED API_KEY_RATE_LIMIT_WINDOW API_KEY_RATE_LIMIT_MAX AUTH_RATE_LIMIT_WINDOW AUTH_CHANGE_EMAIL_RATE_LIMIT_WINDOW AUTH_CHANGE_EMAIL_RATE_LIMIT_MAX EMAIL_STORE_HEADERS_IN_DB EMAIL_STORE_RAW_IN_DB EMAIL_STORE_RAW_IN_R2",
  },
};

const mdxModules = import.meta.glob<DocMdxModule>(
  "../../../content/docs/*.mdx",
  {
    eager: true,
  }
);

function pathToSlug(path: string): string {
  const fileName = path.split("/").at(-1) ?? "";
  return fileName.replace(/\.mdx$/, "");
}

function toHeading(item: {
  id: string;
  title: string;
  level: 2 | 3;
}): DocHeading {
  return {
    id: item.id,
    title: item.title,
    level: item.level,
    href: `#${item.id}`,
  };
}

const pagesBySlug = new Map<string, DocPage>();

for (const [path, mdxModule] of Object.entries(mdxModules)) {
  const slug = pathToSlug(path);
  const indexEntry = DOC_INDEX[slug];
  pagesBySlug.set(slug, {
    slug,
    ...mdxModule.meta,
    headings: (indexEntry?.headings ?? []).map(toHeading),
    searchText: indexEntry?.searchText ?? "",
    codeText: indexEntry?.codeText ?? "",
    markdown: docsMarkdown[slug] ?? "",
    Content: mdxModule.default,
  });
}

function orderedPages(): Array<DocPage> {
  const explicitlyOrdered = docsOrderedSlugs
    .map(slug => pagesBySlug.get(slug))
    .filter((page): page is DocPage => Boolean(page));

  const remaining = Array.from(pagesBySlug.values()).filter(
    page => !docsOrderedSlugs.includes(page.slug)
  );

  return [...explicitlyOrdered, ...remaining];
}

export const docPages: Array<DocPage> = orderedPages();

const docPageBySlug = new Map(docPages.map(page => [page.slug, page] as const));

export function getDocPageBySlug(slug: string): DocPage | undefined {
  return docPageBySlug.get(slug);
}

export function getAllDocPages(): Array<DocPage> {
  return docPages;
}

export function getDocHref(slug: string): string {
  return `/docs/${slug}`;
}

export function buildDocToc(page: DocPage): Array<DocHeading> {
  return page.headings;
}

export function getAdjacentDocPages(slug: string): {
  previous?: DocPage;
  next?: DocPage;
} {
  const index = docPages.findIndex(page => page.slug === slug);
  if (index === -1) {
    return {};
  }

  return {
    previous: docPages[index - 1],
    next: docPages[index + 1],
  };
}
