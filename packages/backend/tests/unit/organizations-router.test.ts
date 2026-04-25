import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { createOrganizationsRouter } from "@/modules/organizations/router";
import { FakeKvNamespace } from "../fixtures/fake-kv";
import { withFixedNow } from "../fixtures/time";

const mocks = vi.hoisted(() => ({
  clearActiveOrganizationSessions: vi.fn(),
  deleteR2ObjectsByPrefix: vi.fn(),
  findOrganizationById: vi.fn(),
  getDb: vi.fn(),
  getOrganizationMemberRole: vi.fn(),
  seedStarterInbox: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/modules/organizations/access", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@/modules/organizations/access")>();

  return {
    ...actual,
    getOrganizationMemberRole: mocks.getOrganizationMemberRole,
  };
});

vi.mock("@/modules/organizations/repo", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@/modules/organizations/repo")>();

  return {
    ...actual,
    clearActiveOrganizationSessions: mocks.clearActiveOrganizationSessions,
    findOrganizationById: mocks.findOrganizationById,
  };
});

vi.mock("@/modules/organizations/starter-inbox", () => ({
  seedStarterInbox: mocks.seedStarterInbox,
}));

vi.mock("@/shared/utils/r2", async importOriginal => {
  const actual = await importOriginal<typeof import("@/shared/utils/r2")>();

  return {
    ...actual,
    deleteR2ObjectsByPrefix: mocks.deleteR2ObjectsByPrefix,
  };
});

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
        deleteOrganization: vi.fn().mockResolvedValue({
          id: "org-1",
          deleted: true,
        }),
        ...authApiOverrides,
      },
    } as AppHonoEnv["Variables"]["auth"]);
    await next();
  });

  app.route("/api", createOrganizationsRouter());
  return app;
};

const createFakeFixedWindowRateLimiters = () => {
  const counters = new Map<string, Map<number, number>>();

  return {
    idFromName: (name: string) => name,
    get: (id: string) => ({
      consume: (windowSeconds: number, maxAttempts: number) => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const windowSlot = Math.floor(nowSeconds / windowSeconds);
        const counter = counters.get(id) ?? new Map<number, number>();
        counters.set(id, counter);

        const current = counter.get(windowSlot) ?? 0;
        if (current >= maxAttempts) {
          return {
            allowed: false as const,
            retryAfterSeconds: Math.max(
              1,
              windowSeconds - (nowSeconds % windowSeconds)
            ),
          };
        }

        counter.set(windowSlot, current + 1);
        return { allowed: true as const };
      },
    }),
  } as unknown as CloudflareBindings["FIXED_WINDOW_RATE_LIMITERS"];
};

const buildEnv = (overrides: Partial<CloudflareBindings> = {}) =>
  ({
    SUM_KV: new FakeKvNamespace(),
    FIXED_WINDOW_RATE_LIMITERS: createFakeFixedWindowRateLimiters(),
    ...overrides,
  }) as unknown as CloudflareBindings;

describe("organizations router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockReturnValue({ id: "db" });
    mocks.findOrganizationById.mockResolvedValue({
      id: "org-1",
      name: "Acme Org",
    });
    mocks.getOrganizationMemberRole.mockResolvedValue("owner");
    mocks.deleteR2ObjectsByPrefix.mockResolvedValue(undefined);
    mocks.clearActiveOrganizationSessions.mockResolvedValue(undefined);
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

  it("deletes an organization for owners after exact name confirmation", async () => {
    mocks.getOrganizationMemberRole.mockResolvedValueOnce("member, owner");
    const deleteOrganization = vi.fn().mockResolvedValue({ deleted: true });
    const app = buildApp({ deleteOrganization });

    const response = await app.request(
      "/api/organizations/org-1",
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirmationName: "Acme Org" }),
      },
      buildEnv({ R2_BUCKET: {} as R2Bucket })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "org-1",
      deleted: true,
    });
    expect(mocks.getOrganizationMemberRole).toHaveBeenCalledWith({
      db: { id: "db" },
      organizationId: "org-1",
      userId: "user-1",
    });
    expect(mocks.deleteR2ObjectsByPrefix).toHaveBeenCalledWith({
      bucket: {},
      prefix: "email-attachments/org-1/",
    });
    expect(mocks.deleteR2ObjectsByPrefix).toHaveBeenCalledWith({
      bucket: {},
      prefix: "email-raw/org-1/",
    });
    expect(deleteOrganization).toHaveBeenCalledWith({
      body: { organizationId: "org-1" },
      headers: expect.any(Headers),
    });
    expect(mocks.clearActiveOrganizationSessions).toHaveBeenCalledWith(
      { id: "db" },
      "org-1"
    );
  });

  it("rejects organization deletion for admins", async () => {
    mocks.getOrganizationMemberRole.mockResolvedValueOnce("admin");
    const deleteOrganization = vi.fn().mockResolvedValue({ deleted: true });
    const app = buildApp({ deleteOrganization });

    const response = await app.request(
      "/api/organizations/org-1",
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirmationName: "Acme Org" }),
      },
      buildEnv()
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "forbidden" });
    expect(deleteOrganization).not.toHaveBeenCalled();
  });

  it("rejects organization deletion when email is not verified", async () => {
    const deleteOrganization = vi.fn().mockResolvedValue({ deleted: true });
    const app = buildApp({
      deleteOrganization,
      getSession: vi.fn().mockResolvedValue({
        session: {
          id: "session-1",
          userId: "user-1",
        },
        user: {
          id: "user-1",
          emailVerified: false,
        },
      }),
    });

    const response = await app.request(
      "/api/organizations/org-1",
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirmationName: "Acme Org" }),
      },
      buildEnv()
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "email verification required",
    });
    expect(deleteOrganization).not.toHaveBeenCalled();
  });

  it("rejects organization deletion when the confirmation name does not match", async () => {
    const deleteOrganization = vi.fn().mockResolvedValue({ deleted: true });
    const app = buildApp({ deleteOrganization });

    const response = await app.request(
      "/api/organizations/org-1",
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirmationName: "Wrong Org" }),
      },
      buildEnv()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "organization name confirmation does not match",
    });
    expect(deleteOrganization).not.toHaveBeenCalled();
  });

  it("rate limits organization deletion to five attempts per hour per user", async () => {
    await withFixedNow("2026-04-25T10:20:00.000Z", async () => {
      const deleteOrganization = vi.fn().mockResolvedValue({ deleted: true });
      const app = buildApp({ deleteOrganization });
      const env = buildEnv();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await app.request(
          "/api/organizations/org-1",
          {
            method: "DELETE",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ confirmationName: "Acme Org" }),
          },
          env
        );

        expect(response.status).toBe(200);
      }

      const response = await app.request(
        "/api/organizations/org-1",
        {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ confirmationName: "Acme Org" }),
        },
        env
      );

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("2400");
      await expect(response.json()).resolves.toEqual({
        error: "too many organization deletion attempts",
        retryAfterSeconds: 2400,
      });
      expect(deleteOrganization).toHaveBeenCalledTimes(5);
    });
  });

  it("rate limits failed organization deletion confirmation attempts", async () => {
    await withFixedNow("2026-04-25T10:20:00.000Z", async () => {
      const deleteOrganization = vi.fn().mockResolvedValue({ deleted: true });
      const app = buildApp({ deleteOrganization });
      const env = buildEnv();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await app.request(
          "/api/organizations/org-1",
          {
            method: "DELETE",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ confirmationName: "Wrong Org" }),
          },
          env
        );

        expect(response.status).toBe(400);
      }

      const response = await app.request(
        "/api/organizations/org-1",
        {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ confirmationName: "Wrong Org" }),
        },
        env
      );

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("2400");
      await expect(response.json()).resolves.toEqual({
        error: "too many organization deletion attempts",
        retryAfterSeconds: 2400,
      });
      expect(deleteOrganization).not.toHaveBeenCalled();
    });
  });

  it("does not fail organization deletion when R2 cleanup fails", async () => {
    mocks.deleteR2ObjectsByPrefix.mockRejectedValueOnce(new Error("r2 down"));
    const deleteOrganization = vi.fn().mockResolvedValue({ deleted: true });
    const app = buildApp({ deleteOrganization });

    const response = await app.request(
      "/api/organizations/org-1",
      {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirmationName: "Acme Org" }),
      },
      buildEnv({ R2_BUCKET: {} as R2Bucket })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "org-1",
      deleted: true,
    });
    expect(deleteOrganization).toHaveBeenCalledWith({
      body: { organizationId: "org-1" },
      headers: expect.any(Headers),
    });
    expect(mocks.clearActiveOrganizationSessions).toHaveBeenCalledWith(
      { id: "db" },
      "org-1"
    );
  });
});
