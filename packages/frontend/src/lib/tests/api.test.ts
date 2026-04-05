import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOrganization,
  downloadEmailAttachment,
  listAllEmailAddresses,
  listDomains,
} from "../api";

const toUrl = (input: RequestInfo | URL) =>
  new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url,
    "https://example.test"
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("api client helpers", () => {
  it("adds org cache key and scope header to requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: ["spinupmail.com"],
          default: "spinupmail.com",
          forcedLocalPartPrefix: "temp",
          maxReceivedEmailsPerOrganization: 1000,
          maxReceivedEmailsPerAddress: 100,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const result = await listDomains({ organizationId: "org-1" });

    expect(result.items).toEqual(["spinupmail.com"]);
    expect(result.forcedLocalPartPrefix).toBe("temp");
    expect(result.maxReceivedEmailsPerOrganization).toBe(1000);
    expect(result.maxReceivedEmailsPerAddress).toBe(100);
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

  it("falls back to plain text when error response is not json", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("text failure", {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "content-type": "text/plain" },
      })
    );

    await expect(listDomains()).rejects.toThrow("text failure");
  });

  it("falls back to status text when error response body is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", {
        status: 502,
        statusText: "Bad Gateway",
      })
    );

    await expect(listDomains()).rejects.toThrow("Bad Gateway");
  });

  it("lists all email addresses across paginated responses", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async input => {
        const url = toUrl(input);
        const page = Number(url.searchParams.get("page") ?? "1");
        const itemId = page === 1 ? "addr-1" : "addr-2";
        return new Response(
          JSON.stringify({
            items: [{ id: itemId }],
            page,
            pageSize: 50,
            totalItems: 2,
            addressLimit: 100,
            totalPages: 2,
            sortBy: "createdAt",
            sortDirection: "desc",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        );
      });

    const result = await listAllEmailAddresses({ organizationId: "org-1" });

    expect(result.map(item => item.id)).toEqual(["addr-1", "addr-2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    for (const [input, init] of fetchMock.mock.calls) {
      const url = toUrl(input);
      expect(url.pathname).toBe("/api/email-addresses");
      expect(url.searchParams.get("_org")).toBe("org-1");
      expect(url.searchParams.get("pageSize")).toBe("50");
      expect(url.searchParams.get("sortBy")).toBe("createdAt");
      expect(url.searchParams.get("sortDirection")).toBe("desc");
      expect((init?.headers as Record<string, string>)["X-Org-Id"]).toBe(
        "org-1"
      );
    }
  });

  it("creates organizations through the app-owned backend endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          organization: {
            id: "org-1",
            name: "Acme",
            slug: "acme",
            logo: null,
          },
          starterAddressId: "address-1",
          seededSampleEmailCount: 3,
        }),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const result = await createOrganization("Acme");

    expect(result.organization.id).toBe("org-1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/organizations");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "Acme" }));
  });

  it("stops pagination when backend reports unsafe page count", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          page: 1,
          pageSize: 50,
          totalItems: 0,
          addressLimit: 100,
          totalPages: 201,
          sortBy: "createdAt",
          sortDirection: "desc",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    await expect(listAllEmailAddresses()).rejects.toThrow(
      "Address pagination reported 201 pages, over safety limit 200."
    );
  });

  it("downloads attachment with decoded UTF-8 filename and revokes object URL", async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:email-attachment");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const anchor = {
      href: "",
      download: "",
      rel: "",
      style: { display: "" },
      click,
    };
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    vi.stubGlobal("window", {
      URL: { createObjectURL, revokeObjectURL },
    });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => anchor),
      body: { appendChild, removeChild },
    });

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("attachment-body", {
        status: 200,
        headers: {
          "Content-Disposition": "attachment; filename*=UTF-8''caf%C3%A9.txt",
        },
      })
    );

    await downloadEmailAttachment({
      emailId: "email-1",
      attachmentId: "attachment-1",
      organizationId: "org-1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] as [RequestInfo, RequestInit];
    const url = toUrl(input);
    expect(url.pathname).toBe("/api/emails/email-1/attachments/attachment-1");
    expect(url.searchParams.get("_org")).toBe("org-1");
    expect((init.headers as Record<string, string>)["X-Org-Id"]).toBe("org-1");
    expect(anchor.download).toBe("café.txt");
    expect(click).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(removeChild).toHaveBeenCalledWith(anchor);

    vi.advanceTimersByTime(100);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:email-attachment");
  });

  it("uses fallback filename and details error message for attachment responses", async () => {
    const click = vi.fn();
    const anchor = {
      href: "",
      download: "",
      rel: "",
      style: { display: "" },
      click,
    };
    vi.stubGlobal("window", {
      URL: {
        createObjectURL: vi.fn(() => "blob:fallback"),
        revokeObjectURL: vi.fn(),
      },
    });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("attachment-body", {
          status: 200,
          headers: {},
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ details: "not allowed" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        })
      );

    await downloadEmailAttachment({
      emailId: "email-2",
      attachmentId: "attachment-2",
      fallbackFilename: "report.txt",
    });
    expect(anchor.download).toBe("report.txt");

    await expect(
      downloadEmailAttachment({
        emailId: "email-3",
        attachmentId: "attachment-3",
      })
    ).rejects.toThrow("not allowed");
  });
});
