import { afterEach, describe, expect, it, vi } from "vitest";

const loadAgentDiscovery = async () => {
  vi.resetModules();
  return import("@/lib/agent-discovery");
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("agent discovery", () => {
  it("does not default discovery metadata to the production API URL", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const { createApiCatalog, createHomepageMarkdown, createOpenApiDocument } =
      await loadAgentDiscovery();

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

  it("documents organization creation without the organization scope header", async () => {
    const { createOpenApiDocument } = await loadAgentDiscovery();
    const document = createOpenApiDocument();
    const operation = document.paths["/api/organizations"].post;

    expect(operation.security).toEqual([{ apiKeyAuth: [] }]);
  });
});

describe("acceptsMarkdown", () => {
  const accepts = async (accept: string | null) => {
    const { acceptsMarkdown } = await import("@/start");
    return acceptsMarkdown(
      new Request("https://spinupmail.com/", {
        headers: accept === null ? undefined : { accept },
      })
    );
  };

  it("requires markdown to be explicitly preferred over html", async () => {
    await expect(accepts("text/markdown")).resolves.toBe(true);
    await expect(accepts("text/html, text/markdown;q=0")).resolves.toBe(false);
    await expect(accepts("text/html, text/markdown;q=0.5")).resolves.toBe(
      false
    );
    await expect(accepts("text/markdown, text/html;q=0.5")).resolves.toBe(true);
    await expect(accepts("text/*;q=0.5, text/markdown")).resolves.toBe(true);
  });

  it("keeps generic browser accept headers on html", async () => {
    await expect(accepts(null)).resolves.toBe(false);
    await expect(accepts("*/*")).resolves.toBe(false);
    await expect(accepts("text/*")).resolves.toBe(false);
    await expect(
      accepts("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
    ).resolves.toBe(false);
  });
});
