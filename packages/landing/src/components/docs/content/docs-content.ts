import { docsOrderedSlugs } from "./docs-nav";
import type { ComponentType } from "react";

export type DocGroupId =
  | "get-started"
  | "configuration"
  | "api-data"
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
  quickstart: {
    headings: [
      { id: "prerequisites", title: "Prerequisites", level: 2 },
      { id: "install-and-run", title: "Install and run", level: 2 },
      { id: "first-successful-flow", title: "First successful flow", level: 2 },
      { id: "first-api-check", title: "First API check", level: 3 },
    ],
    searchText:
      "Cloudflare domain nameservers Email Routing pnpm local development setup sign up create organization temporary address",
    codeText:
      "pnpm install pnpm -C packages/backend dev pnpm -C packages/frontend dev X-API-Key X-Org-Id",
  },
  "cloudflare-resources": {
    headings: [
      { id: "create-d1-kv-and-r2", title: "Create D1, KV, and R2", level: 2 },
      {
        id: "configure-worker-bindings",
        title: "Configure Worker bindings",
        level: 2,
      },
      {
        id: "domain-configuration-strategy",
        title: "Domain configuration strategy",
        level: 2,
      },
    ],
    searchText:
      "Cloudflare resources D1 KV R2 wrangler bindings EMAIL_DOMAINS EMAIL_DOMAIN",
    codeText:
      "wrangler d1 create wrangler kv namespace create wrangler r2 bucket create wrangler.toml",
  },
  "auth-secrets": {
    headings: [
      {
        id: "required-worker-secrets",
        title: "Required Worker secrets",
        level: 2,
      },
      {
        id: "set-better-auth-base-url",
        title: "Set Better Auth Base URL",
        level: 2,
      },
      {
        id: "google-oauth-callback-setup",
        title: "Google OAuth callback setup",
        level: 2,
      },
    ],
    searchText:
      "Better Auth Google OAuth Resend Turnstile secrets CORS_ORIGIN callback",
    codeText:
      "BETTER_AUTH_SECRET BETTER_AUTH_BASE_URL GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET RESEND_API_KEY TURNSTILE_SECRET_KEY",
  },
  "deploy-routing": {
    headings: [
      { id: "deploy-backend-worker", title: "Deploy backend Worker", level: 2 },
      { id: "deploy-frontend-pages", title: "Deploy frontend Pages", level: 2 },
      {
        id: "route-api-paths-to-worker",
        title: "Route API paths to Worker",
        level: 2,
      },
    ],
    searchText: "deploy Worker Pages same host path based routing api",
    codeText:
      "pnpm -C packages/backend deploy VITE_AUTH_BASE_URL VITE_API_BASE_URL",
  },
  "organizations-scope": {
    headings: [
      { id: "scope-model", title: "Scope model", level: 2 },
      {
        id: "organization-stats-endpoints",
        title: "Organization stats endpoints",
        level: 2,
      },
    ],
    searchText: "organization scope session cookie API key X-Org-Id",
    codeText:
      "/api/organizations/stats /api/organizations/stats/email-activity /api/organizations/stats/email-summary",
  },
  "email-addresses": {
    headings: [
      { id: "list-and-create", title: "List and create", level: 2 },
      { id: "update-and-delete", title: "Update and delete", level: 2 },
    ],
    searchText: "email addresses ttl sender domains allowlist policy",
    codeText:
      "/api/email-addresses /api/email-addresses/:id /api/email-addresses/recent-activity maxEmails allowedSenderDomains",
  },
  emails: {
    headings: [
      {
        id: "list-and-detail-endpoints",
        title: "List and detail endpoints",
        level: 2,
      },
      { id: "downloads", title: "Downloads", level: 2 },
    ],
    searchText: "emails detail raw mime attachment download",
    codeText:
      "/api/emails /api/emails/:id /api/emails/:id/raw /api/emails/:id/attachments/:attachmentId",
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
      { id: "size-limits", title: "Size limits", level: 2 },
      { id: "storage-toggles", title: "Storage toggles", level: 2 },
      { id: "access-boundaries", title: "Access boundaries", level: 2 },
    ],
    searchText: "limits security attachment raw mime headers org membership",
    codeText:
      "EMAIL_MAX_BYTES EMAIL_BODY_MAX_BYTES EMAIL_ATTACHMENT_MAX_BYTES EMAIL_STORE_HEADERS_IN_DB EMAIL_STORE_RAW_IN_DB EMAIL_STORE_RAW_IN_R2",
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
