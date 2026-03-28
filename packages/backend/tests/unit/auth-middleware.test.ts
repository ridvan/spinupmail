import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { requireAuth } from "@/app/middleware/require-auth";
import { requireOrganizationScope } from "@/app/middleware/require-organization-scope";

const buildAuthApp = (getSession: ReturnType<typeof vi.fn>) => {
  const app = new Hono<AppHonoEnv>();

  app.use("*", async (c, next) => {
    c.set("auth", {
      api: {
        getSession,
      },
    } as never);
    await next();
  });

  app.use("*", requireAuth);

  app.get("/protected", c => {
    const session = c.get("session");
    return c.json({
      userId: session.user.id,
      sessionId: session.session.id,
    });
  });

  return app;
};

const buildOrganizationScopeApp = (
  getFullOrganization: ReturnType<typeof vi.fn>,
  session: AppHonoEnv["Variables"]["session"]
) => {
  const app = new Hono<AppHonoEnv>();

  app.use("*", async (c, next) => {
    c.set("auth", {
      api: {
        getFullOrganization,
      },
    } as never);
    c.set("session", session);
    await next();
  });

  app.use("*", requireOrganizationScope);

  app.get("/scoped", c => {
    return c.json({ organizationId: c.get("organizationId") });
  });

  return app;
};

describe("auth middleware", () => {
  it("rejects malformed session payloads as unauthorized", async () => {
    const app = buildAuthApp(
      vi.fn().mockResolvedValue({
        session: {
          userId: "user-1",
        },
        user: {
          id: "user-1",
          emailVerified: true,
        },
      })
    );

    const response = await app.request("/protected");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("passes through when session is valid and verified", async () => {
    const app = buildAuthApp(
      vi.fn().mockResolvedValue({
        session: {
          id: "session-1",
          userId: "user-1",
          activeOrganizationId: "org-1",
        },
        user: {
          id: "user-1",
          emailVerified: true,
        },
      })
    );

    const response = await app.request("/protected");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      userId: "user-1",
      sessionId: "session-1",
    });
  });

  it("maps revoked api key auth failures to 401", async () => {
    const app = buildAuthApp(
      vi.fn().mockRejectedValue({
        status: 401,
        message: "API key has been revoked",
      })
    );

    const response = await app.request("/protected");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "api key revoked",
    });
  });
});

describe("organization scope middleware", () => {
  it("requires an active organization for cookie-auth requests", async () => {
    const app = buildOrganizationScopeApp(
      vi.fn().mockResolvedValue({ id: "org-1" }),
      {
        session: {
          id: "session-1",
          userId: "user-1",
          activeOrganizationId: "   ",
        },
        user: {
          id: "user-1",
          emailVerified: true,
        },
      } as never
    );

    const response = await app.request("/scoped");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "active organization is required",
    });
  });

  it("requires x-org-id for api key requests", async () => {
    const app = buildOrganizationScopeApp(
      vi.fn().mockResolvedValue({ id: "org-1" }),
      {
        session: {
          id: "session-1",
          userId: "user-1",
          activeOrganizationId: "org-from-session",
        },
        user: {
          id: "user-1",
          emailVerified: true,
        },
      } as never
    );

    const response = await app.request("/scoped", {
      headers: {
        "x-api-key": "spin_test",
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "x-org-id header is required for api key usage",
    });
  });

  it("maps auth lookup failures to unauthorized", async () => {
    const getFullOrganization = vi.fn().mockRejectedValue({
      status: 401,
      message: "invalid token",
    });
    const app = buildOrganizationScopeApp(getFullOrganization, {
      session: {
        id: "session-1",
        userId: "user-1",
        activeOrganizationId: "org-from-session",
      },
      user: {
        id: "user-1",
        emailVerified: true,
      },
    } as never);

    const response = await app.request("/scoped");

    expect(getFullOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      query: {
        organizationId: "org-from-session",
        membersLimit: 1,
      },
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("sets organization id from the validated session scope", async () => {
    const app = buildOrganizationScopeApp(
      vi.fn().mockResolvedValue({ id: "org-live" }),
      {
        session: {
          id: "session-1",
          userId: "user-1",
          activeOrganizationId: " org-live ",
        },
        user: {
          id: "user-1",
          emailVerified: true,
        },
      } as never
    );

    const response = await app.request("/scoped");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      organizationId: "org-live",
    });
  });
});
