import { describe, expect, it } from "vitest";
import { docPages } from "./docs-content";
import { buildSearchDocuments, searchDocs } from "./docs-search-index";

describe("docs-search-index", () => {
  it("builds documents for pages and sections", () => {
    const docs = buildSearchDocuments(docPages);

    const hasPageDoc = docs.some(
      document => document.id === "api-overview::page"
    );
    const hasSectionDoc = docs.some(
      document => document.id === "api-emails::download-attachment"
    );

    expect(hasPageDoc).toBe(true);
    expect(hasSectionDoc).toBe(true);
  });

  it("ranks title matches above body-only matches", () => {
    const results = searchDocs("api overview");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.document.title).toBe("API Overview");
  });

  it("searches code snippets and env vars", () => {
    const results = searchDocs("allowedFromDomains");
    expect(
      results.some(result =>
        result.document.href.includes("api-email-addresses")
      )
    ).toBe(true);
  });
});
