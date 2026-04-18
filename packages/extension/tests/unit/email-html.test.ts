import {
  hydrateEmailHtmlAssets,
  prepareEmailHtmlForRender,
} from "@/lib/email-html";

describe("email html handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("blocks remote image sources by default", () => {
    const host = document.createElement("div");
    const result = prepareEmailHtmlForRender({
      allowRemoteContent: false,
      html: '<html><body><img src="https://cdn.example.com/hero.png" /><a href="https://example.com">Open</a></body></html>',
      ownerDocument: document,
    });

    host.append(result.fragment);

    expect(result.remoteContentBlocked).toBe(true);
    expect(host.querySelector("img")?.getAttribute("src")).toBeNull();
    expect(host.querySelector("a")?.getAttribute("target")).toBe("_blank");
  });

  it("hydrates authenticated internal assets into object URLs", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: async () => new Blob(["hello"], { type: "text/plain" }),
      ok: true,
    } as Response);
    const createObjectUrlSpy = vi.fn(() => "blob:spinupmail-asset");
    const revokeSpy = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: createObjectUrlSpy,
        revokeObjectURL: revokeSpy,
      })
    );

    const result = await hydrateEmailHtmlAssets({
      connection: {
        apiKey: "key",
        baseUrl: "https://api.spinupmail.com",
      },
      html: '<html><body><img src="/api/emails/email-1/attachments/att-1?inline=1" /></body></html>',
      organizationId: "org-1",
    });

    expect(result.html).toContain('src="blob:spinupmail-asset"');
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.spinupmail.com/api/emails/email-1/attachments/att-1?inline=1",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-API-Key": "key",
          "X-Org-Id": "org-1",
        }),
      })
    );

    result.revoke();
    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith("blob:spinupmail-asset");
  });

  it("hydrates authenticated internal srcset candidates into object URLs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: async () => new Blob(["hello"], { type: "image/png" }),
      ok: true,
    } as Response);
    const createObjectUrlSpy = vi
      .fn()
      .mockReturnValueOnce("blob:spinupmail-asset-1")
      .mockReturnValueOnce("blob:spinupmail-asset-2");
    const revokeSpy = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: createObjectUrlSpy,
        revokeObjectURL: revokeSpy,
      })
    );

    const result = await hydrateEmailHtmlAssets({
      connection: {
        apiKey: "key",
        baseUrl: "https://api.spinupmail.com",
      },
      html: '<html><body><img srcset="/api/emails/email-1/attachments/att-1?inline=1 1x, /api/emails/email-1/attachments/att-2?inline=1 2x" /></body></html>',
      organizationId: "org-1",
    });

    expect(result.html).toContain(
      'srcset="blob:spinupmail-asset-1 1x, blob:spinupmail-asset-2 2x"'
    );

    result.revoke();
    expect(revokeSpy).toHaveBeenCalledWith("blob:spinupmail-asset-1");
    expect(revokeSpy).toHaveBeenCalledWith("blob:spinupmail-asset-2");
  });
});
