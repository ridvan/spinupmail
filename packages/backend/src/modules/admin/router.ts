import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { adminRecordAuditEventRequestSchema } from "@spinupmail/contracts";
import type { AppHonoEnv } from "@/app/types";
import {
  adminActivityQuerySchema,
  adminAnomaliesQuerySchema,
  adminPaginationQuerySchema,
} from "./schemas";
import {
  getAdminActivity,
  getAdminApiKeys,
  getAdminOrganizationDetail,
  getAdminOperationalEvents,
  getAdminOrganizations,
  getAdminOverview,
  getAdminUserDetail,
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

  return router;
};
