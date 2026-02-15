import { listDomains } from "@/lib/api";

describe("api client helpers", () => {
  it("adds org cache key and scope header to requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: ["spinupmail.com"],
          default: "spinupmail.com",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const result = await listDomains({ organizationId: "org-1" });

    expect(result.items).toEqual(["spinupmail.com"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/domains");
    expect(url).toContain("_org=org-1");
    expect((init.headers as Record<string, string>)["X-Org-Id"]).toBe("org-1");
  });

  it("surfaces API error message from json payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    );

    await expect(listDomains()).rejects.toThrow("forbidden");
  });
});
