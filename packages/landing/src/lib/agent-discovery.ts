import { landingLinks } from "./links";
import { siteConfig } from "./site";

const FALLBACK_API_URL = "https://api.spinupmail.com";
const CONTENT_SIGNAL = "ai-train=yes, search=yes, ai-input=yes";

const normalizeUrl = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\/+$/, "");
};

const absoluteUrl = (pathOrUrl: string) => {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${siteConfig.siteUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
};

export const agentDiscovery = {
  apiBaseUrl: normalizeUrl(import.meta.env.VITE_API_BASE_URL, FALLBACK_API_URL),
  apiCatalogPath: "/.well-known/api-catalog",
  openApiPath: "/.well-known/openapi.json",
  docsPath: "/docs/api-overview",
  contentSignal: CONTENT_SIGNAL,
} as const;

export const agentLinkHeader = [
  `</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"`,
  `</.well-known/openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"`,
  `</docs/api-overview>; rel="service-doc"; type="text/html"`,
].join(", ");

export function createApiCatalog() {
  return {
    linkset: [
      {
        anchor: agentDiscovery.apiBaseUrl,
        "service-desc": [
          {
            href: absoluteUrl(agentDiscovery.openApiPath),
            type: "application/vnd.oai.openapi+json",
            title: "SpinupMail OpenAPI description",
          },
        ],
        "service-doc": [
          {
            href: absoluteUrl(agentDiscovery.docsPath),
            type: "text/html",
            title: "SpinupMail API documentation",
          },
        ],
        status: [
          {
            href: `${agentDiscovery.apiBaseUrl}/health`,
            type: "application/json",
            title: "SpinupMail API health check",
          },
        ],
      },
    ],
  };
}

export function createOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "SpinupMail API",
      version: "1.0.0",
      description:
        "Product API for SpinupMail organizations, domains, disposable email addresses, received emails, and integrations.",
    },
    servers: [
      {
        url: agentDiscovery.apiBaseUrl,
        description: "Production API",
      },
    ],
    security: [{ apiKeyAuth: [], organizationId: [] }],
    paths: {
      "/health": {
        get: {
          summary: "Health check",
          security: [],
          responses: {
            "200": {
              description: "The API worker is reachable.",
            },
          },
        },
      },
      "/api/domains": {
        get: {
          summary: "List configured email domains",
          responses: {
            "200": {
              description: "Email domains available to the organization.",
            },
          },
        },
      },
      "/api/organizations": {
        post: {
          summary: "Create an organization",
          responses: {
            "201": {
              description: "Organization created.",
            },
          },
        },
      },
      "/api/organizations/stats": {
        get: {
          summary: "Get organization dashboard stats",
          responses: {
            "200": {
              description: "Organization usage and activity stats.",
            },
          },
        },
      },
      "/api/organizations/stats/email-activity": {
        get: {
          summary: "Get received email activity",
          responses: {
            "200": {
              description: "Time-series email activity for the organization.",
            },
          },
        },
      },
      "/api/organizations/stats/email-summary": {
        get: {
          summary: "Get received email summary",
          responses: {
            "200": {
              description: "Aggregate email counts for the organization.",
            },
          },
        },
      },
      "/api/email-addresses": {
        get: {
          summary: "List disposable email addresses",
          responses: {
            "200": {
              description: "Email addresses for the organization.",
            },
          },
        },
        post: {
          summary: "Create a disposable email address",
          responses: {
            "201": {
              description: "Email address created.",
            },
          },
        },
      },
      "/api/email-addresses/recent-activity": {
        get: {
          summary: "List recent address activity",
          responses: {
            "200": {
              description: "Recent address activity entries.",
            },
          },
        },
      },
      "/api/email-addresses/{id}": {
        get: {
          summary: "Get a disposable email address",
          parameters: [pathIdParameter],
          responses: {
            "200": {
              description: "Email address details.",
            },
          },
        },
        patch: {
          summary: "Update a disposable email address",
          parameters: [pathIdParameter],
          responses: {
            "200": {
              description: "Email address updated.",
            },
          },
        },
        delete: {
          summary: "Delete a disposable email address",
          parameters: [pathIdParameter],
          responses: {
            "204": {
              description: "Email address deleted.",
            },
          },
        },
      },
      "/api/emails": {
        get: {
          summary: "List received emails",
          responses: {
            "200": {
              description: "Received emails for the organization.",
            },
          },
        },
      },
      "/api/emails/{id}": {
        get: {
          summary: "Get a received email",
          parameters: [pathIdParameter],
          responses: {
            "200": {
              description: "Received email details.",
            },
          },
        },
        delete: {
          summary: "Delete a received email",
          parameters: [pathIdParameter],
          responses: {
            "204": {
              description: "Email deleted.",
            },
          },
        },
      },
      "/api/emails/{id}/raw": {
        get: {
          summary: "Download a raw email",
          parameters: [pathIdParameter],
          responses: {
            "200": {
              description: "Raw RFC 822 email content.",
            },
          },
        },
      },
      "/api/emails/{emailId}/attachments/{attachmentId}": {
        get: {
          summary: "Download an email attachment",
          parameters: [
            {
              name: "emailId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "attachmentId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Attachment content.",
            },
          },
        },
      },
      "/api/integrations": {
        get: {
          summary: "List organization integrations",
          responses: {
            "200": {
              description: "Configured integrations.",
            },
          },
        },
        post: {
          summary: "Create an integration",
          responses: {
            "201": {
              description: "Integration created.",
            },
          },
        },
      },
      "/api/integrations/{id}": {
        patch: {
          summary: "Update an integration",
          parameters: [pathIdParameter],
          responses: {
            "200": {
              description: "Integration updated.",
            },
          },
        },
        delete: {
          summary: "Delete an integration",
          parameters: [pathIdParameter],
          responses: {
            "204": {
              description: "Integration deleted.",
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
        organizationId: {
          type: "apiKey",
          in: "header",
          name: "X-Org-Id",
        },
      },
    },
    externalDocs: {
      description: "SpinupMail API documentation",
      url: absoluteUrl(landingLinks.apiDocs),
    },
  };
}

export function createHomepageMarkdown() {
  return `---
title: ${siteConfig.title}
description: ${siteConfig.description}
---

# SpinupMail

Self-hosted disposable email infrastructure for teams on Cloudflare.

SpinupMail gives teams temporary inboxes, API access, TTL controls, sender policies, attachment support, and organization-scoped management without relying on a hosted mailbox provider.

## Agent resources

- API catalog: ${absoluteUrl(agentDiscovery.apiCatalogPath)}
- OpenAPI description: ${absoluteUrl(agentDiscovery.openApiPath)}
- API documentation: ${absoluteUrl(agentDiscovery.docsPath)}
- GitHub repository: ${landingLinks.github}
- App: ${landingLinks.app}

## API

Use ${agentDiscovery.apiBaseUrl} as the production API origin. Product endpoints are under /api, and the lightweight health probe is ${agentDiscovery.apiBaseUrl}/health.

## Content usage

Content-Signal: ${agentDiscovery.contentSignal}
`;
}

export function estimateMarkdownTokens(markdown: string) {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return String(Math.ceil(words * 1.3));
}

const pathIdParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
};
