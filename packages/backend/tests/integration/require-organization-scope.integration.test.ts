import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { requireOrganizationScope } from "@/app/middleware/require-organization-scope";

const buildScopedApp = (options?: {
  fullOrganizationResponse?: { id?: string | null } | null;
  activeOrganizationId?: string | null;
}) => {
  const app = new Hono<AppHonoEnv>();
  const fullOrganizationResponse =
    options && "fullOrganizationResponse" in options
      ? options.fullOrganizationResponse
      : { id: "org-1" };

  app.use("*", async (c, next) => {
    c.set("auth", {
      api: {
        getFullOrganization: vi
          .fn()
          .mockResolvedValue(fullOrganizationResponse),
      },
    } as never);

    c.set("session", {
      session: {
        activeOrganizationId:
          options?.activeOrganizationId ?? "org-from-session",
      },
      user: {
        id: "user-1",
      },
    } as never);

    await next();
  });

  app.use("*", requireOrganizationScope);

  app.get("/scoped", c => {
    return c.json({ organizationId: c.get("organizationId") });
  });

  return app;
};

describe("requireOrganizationScope middleware", () => {
  it("sets organization from session for cookie-auth requests", async () => {
    const app = buildScopedApp();
    const response = await app.request("/scoped");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      organizationId: "org-from-session",
    });
  });

  it("prefers explicit x-org-id for api key requests", async () => {
    const app = buildScopedApp();
    const response = await app.request("/scoped", {
      headers: {
        "x-api-key": "spin_key",
        "x-org-id": "org-header",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ organizationId: "org-header" });
  });

  it("returns forbidden when organization lookup fails", async () => {
    const app = buildScopedApp({ fullOrganizationResponse: null });
    const response = await app.request("/scoped", {
      headers: {
        "x-api-key": "spin_key",
        "x-org-id": "org-header",
      },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
  });
});
