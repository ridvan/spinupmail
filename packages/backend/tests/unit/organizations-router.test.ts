import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { createOrganizationsRouter } from "@/modules/organizations/router";

const mocks = vi.hoisted(() => ({
  seedStarterInbox: vi.fn(),
}));

vi.mock("@/modules/organizations/starter-inbox", () => ({
  seedStarterInbox: mocks.seedStarterInbox,
}));

const buildApp = (authApiOverrides?: Record<string, unknown>) => {
  const app = new Hono<AppHonoEnv>();

  app.use("*", async (c, next) => {
    c.set("auth", {
      api: {
        getSession: vi.fn().mockResolvedValue({
          session: {
            id: "session-1",
            userId: "user-1",
          },
          user: {
            id: "user-1",
            emailVerified: true,
          },
        }),
        createOrganization: vi.fn().mockResolvedValue({
          id: "org-1",
          name: "Acme Org",
          slug: "acme-org",
          logo: null,
        }),
        ...authApiOverrides,
      },
    } as AppHonoEnv["Variables"]["auth"]);
    await next();
  });

  app.route("/api", createOrganizationsRouter());
  return app;
};

describe("organizations router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.seedStarterInbox.mockResolvedValue({
      starterAddressId: "address-1",
      starterAddress: "starter@spinupmail.com",
      seededSampleEmailCount: 3,
      createdStarterAddress: true,
    });
  });

  it("creates an organization and returns starter inbox metadata", async () => {
    const app = buildApp();

    const response = await app.request(
      "/api/organizations",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Acme Org" }),
      },
      { EMAIL_DOMAINS: "spinupmail.com" } as CloudflareBindings
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      organization: {
        id: "org-1",
        name: "Acme Org",
        slug: "acme-org",
        logo: null,
      },
      starterAddressId: "address-1",
      seededSampleEmailCount: 3,
      starterInboxProvisioned: true,
    });
    expect(mocks.seedStarterInbox).toHaveBeenCalledWith({
      env: { EMAIL_DOMAINS: "spinupmail.com" },
      organizationId: "org-1",
      userId: "user-1",
      organizationName: "Acme Org",
    });
  });

  it("surfaces blocking starter inbox failures", async () => {
    mocks.seedStarterInbox.mockRejectedValueOnce(new Error("seed failed"));
    const app = buildApp();

    const response = await app.request(
      "/api/organizations",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Acme Org" }),
      },
      { EMAIL_DOMAINS: "spinupmail.com" } as CloudflareBindings
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.organization).toEqual({
      id: "org-1",
      name: "Acme Org",
      slug: "acme-org",
      logo: null,
    });
    expect(body.starterAddressId).toBeNull();
    expect(body.seededSampleEmailCount).toBe(0);
    expect(body.starterInboxProvisioned).toBe(false);
    expect(body.warning).toContain(
      "Starter inbox setup failed for organization org-1: seed failed."
    );
    expect(body.warning).toContain("Starter inbox setup can be retried later.");
    expect(body.warning).toContain(
      "contact support with organization ID org-1."
    );
  });

  it("retries organization creation on explicit slug collisions", async () => {
    const createOrganization = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          'duplicate key value violates unique constraint "organizations_slug_key"'
        )
      )
      .mockResolvedValueOnce({
        id: "org-1",
        name: "Acme Org",
        slug: "acme-org",
        logo: null,
      });
    const app = buildApp({ createOrganization });

    const response = await app.request(
      "/api/organizations",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Acme Org" }),
      },
      { EMAIL_DOMAINS: "spinupmail.com" } as CloudflareBindings
    );

    expect(response.status).toBe(201);
    expect(createOrganization).toHaveBeenCalledTimes(2);
  });

  it("does not retry on vague slug errors", async () => {
    const createOrganization = vi
      .fn()
      .mockRejectedValueOnce(new Error("Slug validation service unavailable"))
      .mockResolvedValueOnce({
        id: "org-1",
        name: "Acme Org",
        slug: "acme-org",
        logo: null,
      });
    const app = buildApp({ createOrganization });

    const response = await app.request(
      "/api/organizations",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Acme Org" }),
      },
      { EMAIL_DOMAINS: "spinupmail.com" } as CloudflareBindings
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to create organization",
    });
    expect(createOrganization).toHaveBeenCalledTimes(1);
  });
});
