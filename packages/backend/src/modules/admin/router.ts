import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  adminRecordAuditEventRequestSchema,
  adminUserActionRequestSchema,
} from "@spinupmail/contracts";
import type { AppHonoEnv } from "@/app/types";
import {
  adminActivityQuerySchema,
  adminAnomaliesQuerySchema,
  adminPaginationQuerySchema,
} from "./schemas";
import {
  getAdminActivity,
  getAdminApiKeys,
  getAdminActionErrorResponse,
  getAdminOrganizationDetail,
  getAdminOperationalEvents,
  getAdminOrganizations,
  getAdminOverview,
  getAdminUserDetail,
  performAdminUserAction,
  recordAdminAuditEvent,
} from "./service";

const idParamSchema = z.object({
  id: z.string().min(1),
});

export const createAdminRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.get("/admin/overview", async c => {
    const result = await getAdminOverview(c.env);
    return c.json(result, 200, {
      "Cache-Control": "private, max-age=30",
    });
  });

  router.get(
    "/admin/activity",
    zValidator("query", adminActivityQuerySchema, (result, c) => {
      if (!result.success) return c.json({ error: "invalid admin query" }, 400);
      return undefined;
    }),
    async c => {
      const query = c.req.valid("query");
      const result = await getAdminActivity({
        env: c.env,
        daysRaw: query.days,
        timezoneRaw: query.timezone,
      });
      return c.json(result.body, result.status, {
        "Cache-Control": "private, max-age=30",
      });
    }
  );

  router.get(
    "/admin/organizations",
    zValidator("query", adminPaginationQuerySchema, (result, c) => {
      if (!result.success) return c.json({ error: "invalid admin query" }, 400);
      return undefined;
    }),
    async c => {
      const query = c.req.valid("query");
      const result = await getAdminOrganizations({
        env: c.env,
        pageRaw: query.page,
        pageSizeRaw: query.pageSize,
      });
      return c.json(result, 200, {
        "Cache-Control": "private, max-age=30",
      });
    }
  );

  router.get(
    "/admin/users/:id",
    zValidator("param", idParamSchema, (result, c) => {
      if (!result.success) return c.json({ error: "invalid admin user" }, 400);
      return undefined;
    }),
    async c => {
      const { id } = c.req.valid("param");
      const result = await getAdminUserDetail({ env: c.env, userId: id });
      return c.json(result.body, result.status, {
        "Cache-Control": "private, max-age=15",
      });
    }
  );

  router.get(
    "/admin/organizations/:id",
    zValidator("param", idParamSchema, (result, c) => {
      if (!result.success)
        return c.json({ error: "invalid admin organization" }, 400);
      return undefined;
    }),
    async c => {
      const { id } = c.req.valid("param");
      const result = await getAdminOrganizationDetail({
        env: c.env,
        organizationId: id,
      });
      return c.json(result.body, result.status, {
        "Cache-Control": "private, max-age=15",
      });
    }
  );

  router.get(
    "/admin/api-keys",
    zValidator("query", adminPaginationQuerySchema, (result, c) => {
      if (!result.success) return c.json({ error: "invalid admin query" }, 400);
      return undefined;
    }),
    async c => {
      const query = c.req.valid("query");
      const result = await getAdminApiKeys({
        env: c.env,
        pageRaw: query.page,
        pageSizeRaw: query.pageSize,
      });
      return c.json(result, 200, {
        "Cache-Control": "private, max-age=15",
      });
    }
  );

  router.get(
    "/admin/anomalies",
    zValidator("query", adminAnomaliesQuerySchema, (result, c) => {
      if (!result.success) return c.json({ error: "invalid admin query" }, 400);
      return undefined;
    }),
    async c => {
      const query = c.req.valid("query");
      const result = await getAdminOperationalEvents({
        env: c.env,
        pageRaw: query.page,
        pageSizeRaw: query.pageSize,
        severity: query.severity,
        type: query.type,
        organizationId: query.organizationId,
        fromRaw: query.from,
        toRaw: query.to,
      });
      return c.json(result, 200, {
        "Cache-Control": "private, max-age=30",
      });
    }
  );

  router.post(
    "/admin/audit-events",
    zValidator("json", adminRecordAuditEventRequestSchema, (result, c) => {
      if (!result.success)
        return c.json({ error: "invalid admin audit event" }, 400);
      return undefined;
    }),
    async c => {
      const session = c.get("session");
      const input = c.req.valid("json");
      const result = await recordAdminAuditEvent({
        env: c.env,
        actorUserId: session.user.id,
        actorEmail:
          typeof session.user.email === "string" ? session.user.email : null,
        input,
      });
      return c.json(result, 201);
    }
  );

  router.post(
    "/admin/user-actions",
    zValidator("json", adminUserActionRequestSchema, (result, c) => {
      if (!result.success)
        return c.json({ error: "invalid admin user action" }, 400);
      return undefined;
    }),
    async c => {
      const auth = c.get("auth");
      const session = c.get("session");
      const input = c.req.valid("json");

      try {
        const result = await performAdminUserAction({
          env: c.env,
          runImpersonation:
            input.action === "impersonate"
              ? () => {
                  const url = new URL(c.req.url);
                  url.pathname = "/api/auth/admin/impersonate-user";
                  url.search = "";
                  const headers = new Headers(c.req.raw.headers);
                  headers.set("Content-Type", "application/json");
                  return auth.handler(
                    new Request(url, {
                      method: "POST",
                      headers,
                      body: JSON.stringify({ userId: input.userId }),
                    })
                  );
                }
              : undefined,
          actorUserId: session.user.id,
          actorEmail:
            typeof session.user.email === "string" ? session.user.email : null,
          actorRole: session.user.role,
          input,
        });
        if (result instanceof Response) return result;
        return c.json(result, 200);
      } catch (error) {
        const response = getAdminActionErrorResponse(error);
        if (response) {
          if ("response" in response) return response.response;
          return c.json(response.body, response.status);
        }
        throw error;
      }
    }
  );

  return router;
};
