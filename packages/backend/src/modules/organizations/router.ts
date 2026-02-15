import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import {
  getEmailActivityStats,
  getEmailSummaryStats,
  getOrganizationStats,
} from "./service";

export const createOrganizationsRouter = () => {
  const router = new Hono<AppHonoEnv>();

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
    });

    return c.json(result, 200, {
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
