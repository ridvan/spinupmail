import { describe, expect, it } from "vitest";

import {
  createApiCatalog,
  createHomepageMarkdown,
  createOpenApiDocument,
} from "@/lib/agent-discovery";
import { acceptsMarkdown } from "@/start";

describe("agent discovery", () => {
  it("does not default discovery metadata to the production API URL", () => {
    const catalog = JSON.stringify(createApiCatalog());
    const openApi = JSON.stringify(createOpenApiDocument());
    const markdown = createHomepageMarkdown();

    expect(catalog).not.toContain("https://api.spinupmail.com");
    expect(openApi).not.toContain("https://api.spinupmail.com");
    expect(markdown).not.toContain("https://api.spinupmail.com");
    expect(catalog).toContain("http://localhost:8787");
    expect(openApi).toContain("http://localhost:8787");
    expect(markdown).toContain("API origin is not configured");
  });

  it("documents organization creation without the organization scope header", () => {
    const document = createOpenApiDocument();
    const operation = document.paths["/api/organizations"].post;

    expect(operation.security).toEqual([{ apiKeyAuth: [] }]);
  });
});

describe("acceptsMarkdown", () => {
  const accepts = (accept: string | null) =>
    acceptsMarkdown(
      new Request("https://spinupmail.com/", {
        headers: accept === null ? undefined : { accept },
      })
    );

  it("requires markdown to be explicitly preferred over html", () => {
    expect(accepts("text/markdown")).toBe(true);
    expect(accepts("text/html, text/markdown;q=0")).toBe(false);
    expect(accepts("text/html, text/markdown;q=0.5")).toBe(false);
    expect(accepts("text/markdown, text/html;q=0.5")).toBe(true);
  });

  it("keeps generic browser accept headers on html", () => {
    expect(accepts(null)).toBe(false);
    expect(accepts("*/*")).toBe(false);
    expect(
      accepts("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
    ).toBe(false);
  });
});
