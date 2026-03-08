import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeKvNamespace } from "../fixtures/fake-kv";

const buildResponse = (body: string, init?: ResponseInit) =>
  new Response(body, {
    status: 200,
    headers: {
      "content-length": String(new TextEncoder().encode(body).byteLength),
      etag: '"domains-v1"',
      ...init?.headers,
    },
    ...init,
  });

describe("disposable email domains", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches, shards, and caches the upstream list on first lookup", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        buildResponse("remote-temp.test\nmailinator.com\n")
      );
    vi.stubGlobal("fetch", fetchMock);

    const {
      isDisposableEmailDomain,
      resetDisposableEmailDomainCachesForTests,
    } = await import("@/platform/auth/disposable-email-domains");
    resetDisposableEmailDomainCachesForTests();

    const env = {
      SUM_KV: new FakeKvNamespace(),
    } as unknown as CloudflareBindings;

    await expect(
      isDisposableEmailDomain("remote-temp.test", env)
    ).resolves.toBe(true);
    await expect(
      isDisposableEmailDomain("remote-temp.test", env)
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const manifest = await env.SUM_KV.get(
      "auth:disposable-email-domains:manifest"
    );
    expect(manifest).toContain('"domainCount":2');
  });

  it("uses cached shards while scheduling a background refresh after soft expiry", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => buildResponse("remote-temp.test\n"));
    vi.stubGlobal("fetch", fetchMock);

    const {
      isDisposableEmailDomain,
      refreshDisposableEmailDomains,
      resetDisposableEmailDomainCachesForTests,
    } = await import("@/platform/auth/disposable-email-domains");

    const env = {
      SUM_KV: new FakeKvNamespace(),
    } as unknown as CloudflareBindings;

    resetDisposableEmailDomainCachesForTests();
    const manifest = await refreshDisposableEmailDomains(env, { force: true });
    expect(manifest).not.toBeNull();

    const staleManifest = {
      ...manifest!,
      refreshAfter: new Date(Date.now() - 1_000).toISOString(),
      hardExpireAt: new Date(Date.now() + 60_000).toISOString(),
    };
    await env.SUM_KV.put(
      "auth:disposable-email-domains:manifest",
      JSON.stringify(staleManifest)
    );
    resetDisposableEmailDomainCachesForTests();

    const runInBackground = vi.fn((promise: Promise<unknown>) => promise);

    await expect(
      isDisposableEmailDomain("remote-temp.test", env, { runInBackground })
    ).resolves.toBe(true);

    expect(runInBackground).toHaveBeenCalledTimes(1);
  });

  it("clears refreshInFlight after a failed lock acquisition", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => buildResponse("remote-temp.test\n"));
    vi.stubGlobal("fetch", fetchMock);

    const {
      refreshDisposableEmailDomains,
      resetDisposableEmailDomainCachesForTests,
    } = await import("@/platform/auth/disposable-email-domains");

    const env = {
      SUM_KV: new FakeKvNamespace(),
    } as unknown as CloudflareBindings;

    resetDisposableEmailDomainCachesForTests();
    await env.SUM_KV.put(
      "auth:disposable-email-domains:refresh-lock",
      "held-by-another-isolate"
    );

    await expect(refreshDisposableEmailDomains(env)).resolves.toBeNull();

    await env.SUM_KV.delete("auth:disposable-email-domains:refresh-lock");

    await expect(refreshDisposableEmailDomains(env)).resolves.toMatchObject({
      domainCount: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never blocks configured service domains from EMAIL_DOMAINS", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        buildResponse("spinupmail.com\nremote-temp.test\n")
      );
    vi.stubGlobal("fetch", fetchMock);

    const {
      isDisposableEmailDomain,
      resetDisposableEmailDomainCachesForTests,
    } = await import("@/platform/auth/disposable-email-domains");
    resetDisposableEmailDomainCachesForTests();

    const env = {
      SUM_KV: new FakeKvNamespace(),
      EMAIL_DOMAINS: "spinupmail.com,spinuptest.com",
      EMAIL_DOMAIN: "spinupmail.com",
    } as unknown as CloudflareBindings;

    await expect(isDisposableEmailDomain("spinupmail.com", env)).resolves.toBe(
      false
    );
    await expect(
      isDisposableEmailDomain("remote-temp.test", env)
    ).resolves.toBe(true);
  });
});
