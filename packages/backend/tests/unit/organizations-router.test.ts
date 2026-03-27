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

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Organization created but starter inbox setup failed: seed failed",
    });
  });
});
