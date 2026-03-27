import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppHonoEnv } from "@/app/types";
import { requireAuth } from "@/app/middleware/require-auth";
import {
  createOrganization,
  getEmailActivityStats,
  getEmailSummaryStats,
  getOrganizationStats,
} from "./service";
import { createOrganizationBodySchema } from "./schemas";

export const createOrganizationsRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.post(
    "/organizations",
    requireAuth,
    zValidator("json", createOrganizationBodySchema, (result, c) => {
      if (!result.success) {
        return c.json(
          { error: "Organization name must be between 2 and 64 characters" },
          400
        );
      }
      return undefined;
    }),
    async c => {
      const auth = c.get("auth");
      const session = c.get("session");
      const payload = c.req.valid("json");

      const result = await createOrganization({
        env: c.env,
        auth,
        headers: c.req.raw.headers,
        session,
        payload,
      });

      return c.json(result.body, result.status);
    }
  );

  router.get("/organizations/stats", async c => {
    const session = c.get("session");
    const userId = session.user.id;

    if (!userId) {
      c.status(401);
      return c.json({ error: "unauthorized" });
    }

    const result = await getOrganizationStats(c.env, userId);
    return c.json(result, 200, {
      "Cache-Control": "private, max-age=60",
    });
  });

  router.get("/organizations/stats/email-activity", async c => {
    const organizationId = c.get("organizationId");
    const query = new URL(c.req.url).searchParams;

    const result = await getEmailActivityStats({
      env: c.env,
      organizationId,
      daysRaw: query.get("days"),
      timezoneRaw: query.get("timezone"),
    });

    if (result.status !== 200) {
      return c.json(result.body, result.status);
    }

    return c.json(result.body, result.status, {
      "Cache-Control": "private, max-age=60",
    });
  });

  router.get("/organizations/stats/email-summary", async c => {
    const organizationId = c.get("organizationId");

    const result = await getEmailSummaryStats({
      env: c.env,
      organizationId,
    });

    return c.json(result, 200, {
      "Cache-Control": "private, max-age=60",
    });
  });

  return router;
};
