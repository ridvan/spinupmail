import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppHonoEnv } from "@/app/types";
import {
  adminActivityQuerySchema,
  adminAnomaliesQuerySchema,
  adminPaginationQuerySchema,
} from "./schemas";
import {
  getAdminActivity,
  getAdminOperationalEvents,
  getAdminOrganizations,
  getAdminOverview,
} from "./service";

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

  return router;
};
