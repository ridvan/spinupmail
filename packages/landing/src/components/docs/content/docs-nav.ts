import type { DocNavGroup } from "./docs-content";

export const docsNavGroups: Array<DocNavGroup> = [
  {
    id: "get-started",
    title: "Get Started",
    description: "Install and first run.",
    slugs: ["quickstart"],
  },
  {
    id: "api-reference",
    title: "API Reference",
    description: "Authentication model and exhaustive endpoint contracts.",
    slugs: [
      "api-overview",
      "api-domains",
      "api-organizations",
      "api-email-addresses",
      "api-emails",
    ],
  },
  {
    id: "configuration",
    title: "Configuration",
    description: "Cloudflare, auth, and deploy setup.",
    slugs: ["cloudflare-resources", "auth-secrets", "deploy-routing"],
  },
  {
    id: "operations",
    title: "Operations",
    description: "Inbound flow and production operations.",
    slugs: [
      "inbound-pipeline",
      "multi-domain",
      "local-development",
      "limits-security",
    ],
  },
];

export const docsOrderedSlugs = docsNavGroups.flatMap(group => group.slugs);
