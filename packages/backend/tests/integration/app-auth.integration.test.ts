import { createApp } from "@/index";

type SessionShape = {
  session?: {
    id: string;
    userId?: string;
    activeOrganizationId?: string | null;
  };
  user?: {
    id: string;
    emailVerified?: boolean | null;
  };
} | null;

const createAuthFactory = (options: {
  session: SessionShape;
  organization?: { id?: string | null } | null;
}) => {
  const organization =
    "organization" in options ? options.organization : { id: "org-1" };

  return () => {
    return {
      api: {
        getSession: vi.fn().mockResolvedValue(options.session),
        getFullOrganization: vi.fn().mockResolvedValue(organization),
      },
      handler: vi.fn().mockResolvedValue(new Response("ok")),
    } as never;
  };
};

const executionCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

const testBindings = {
  EMAIL_DOMAINS: "spinupmail.com",
} as unknown as CloudflareBindings;

describe("app auth middleware integration", () => {
  it("returns 401 when session is missing", async () => {
    const app = createApp({
      createAuthFactory: createAuthFactory({ session: null }),
    });

    const response = await app.request(
      "/api/domains",
      undefined,
      testBindings,
      executionCtx as never
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("returns 403 when user email is not verified", async () => {
    const app = createApp({
      createAuthFactory: createAuthFactory({
        session: {
          session: {
            id: "session-1",
            userId: "user-1",
            activeOrganizationId: "org-1",
          },
          user: { id: "user-1", emailVerified: false },
        },
      }),
    });

    const response = await app.request(
      "/api/domains",
      undefined,
      testBindings,
      executionCtx as never
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "email verification required",
    });
  });

  it("returns 400 for api-key scoped routes without x-org-id", async () => {
    const app = createApp({
      createAuthFactory: createAuthFactory({
        session: {
          session: {
            id: "session-1",
            userId: "user-1",
            activeOrganizationId: "org-1",
          },
          user: { id: "user-1", emailVerified: true },
        },
      }),
    });

    const response = await app.request(
      "/api/emails/test-email",
      {
        headers: {
          "x-api-key": "spin_test",
        },
      },
      testBindings,
      executionCtx as never
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "x-org-id header is required for api key usage",
    });
  });

  it("returns 403 when the requested organization is not accessible", async () => {
    const app = createApp({
      createAuthFactory: createAuthFactory({
        session: {
          session: {
            id: "session-1",
            userId: "user-1",
            activeOrganizationId: "org-1",
          },
          user: { id: "user-1", emailVerified: true },
        },
        organization: null,
      }),
    });

    const response = await app.request(
      "/api/emails/test-email",
      {
        headers: {
          "x-api-key": "spin_test",
          "x-org-id": "org-unknown",
        },
      },
      testBindings,
      executionCtx as never
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
  });

  it("does not expose E2E auth routes in the default app", async () => {
    const app = createApp({
      createAuthFactory: createAuthFactory({ session: null }),
    });

    const response = await app.request(
      "/api/test/auth/session",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-e2e-test-secret": "top-secret",
        },
        body: JSON.stringify({}),
      },
      testBindings,
      executionCtx as never
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not found" });
  });
});
