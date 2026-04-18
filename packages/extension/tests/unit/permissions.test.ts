import {
  ensureOriginPermission,
  manifestIncludesOrigin,
} from "@/lib/permissions";

describe("extension permissions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("matches origin patterns declared in the manifest", () => {
    expect(
      manifestIncludesOrigin(
        ["http://localhost:8787/*", "https://*/*"],
        "http://localhost:8787/*"
      )
    ).toBe(true);
    expect(
      manifestIncludesOrigin(["https://*/*"], "http://localhost:8787/*")
    ).toBe(false);
  });

  it("does not request origins already granted by required manifest permissions", async () => {
    const contains = vi.fn();
    const request = vi.fn();

    vi.stubGlobal("browser", {
      permissions: {
        contains,
        request,
      },
      runtime: {
        getManifest: () => ({
          host_permissions: ["http://localhost:8787/*"],
          permissions: ["storage"],
        }),
      },
    });

    await expect(ensureOriginPermission("http://localhost:8787")).resolves.toBe(
      true
    );
    expect(contains).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("requests optional origins when they are declared but not yet granted", async () => {
    const contains = vi.fn().mockResolvedValue(false);
    const request = vi.fn().mockResolvedValue(true);

    vi.stubGlobal("browser", {
      permissions: {
        contains,
        request,
      },
      runtime: {
        getManifest: () => ({
          optional_host_permissions: ["https://*/*"],
          permissions: ["storage"],
        }),
      },
    });

    await expect(
      ensureOriginPermission("https://mail.example.com")
    ).resolves.toBe(true);
    expect(contains).toHaveBeenCalledWith({
      origins: ["https://mail.example.com/*"],
    });
    expect(request).toHaveBeenCalledWith({
      origins: ["https://mail.example.com/*"],
    });
  });
});
