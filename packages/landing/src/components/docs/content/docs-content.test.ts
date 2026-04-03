import { describe, expect, it } from "vitest";
import { buildDocToc, docPages, getDocPageBySlug } from "./docs-content";

describe("docs-content", () => {
  it("contains all required documentation slugs", () => {
    const requiredSlugs = [
      "installation",
      "api-overview",
      "api-domains",
      "api-organizations",
      "api-email-addresses",
      "api-emails",
      "cloudflare-resources",
      "auth-secrets",
      "deploy-routing",
      "inbound-pipeline",
      "multi-domain",
      "local-development",
      "limits-security",
    ];

    const slugs = new Set(docPages.map(page => page.slug));

    for (const slug of requiredSlugs) {
      expect(slugs.has(slug)).toBe(true);
    }
  });

  it("returns undefined for missing slugs", () => {
    expect(getDocPageBySlug("unknown-doc")).toBeUndefined();
  });

  it("builds TOC headings from section and subsection metadata", () => {
    const page = getDocPageBySlug("api-email-addresses");
    expect(page).toBeDefined();

    const toc = buildDocToc(page!);

    expect(toc.length).toBeGreaterThan(0);
    expect(
      toc.some(
        heading =>
          heading.level === 2 && heading.id === "create-an-email-address"
      )
    ).toBe(true);
  });
});
