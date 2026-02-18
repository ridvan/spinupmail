import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppHonoEnv } from "@/app/types";
import {
  createEmailAddress,
  deleteEmailAddress,
  listEmailAddresses,
  listRecentAddressActivity,
  updateEmailAddress,
} from "./service";
import {
  createEmailAddressBodySchema,
  listEmailAddressesQuerySchema,
  listRecentAddressActivityQuerySchema,
  updateEmailAddressBodySchema,
} from "./schemas";

export const createEmailAddressesRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.get(
    "/email-addresses/recent-activity",
    zValidator("query", listRecentAddressActivityQuerySchema),
    async c => {
      const organizationId = c.get("organizationId");
      const query = c.req.valid("query");
      const result = await listRecentAddressActivity({
        env: c.env,
        organizationId,
        queryPayload: query,
      });

      return c.json(result.body, result.status, {
        "Cache-Control": "private, max-age=5",
      });
    }
  );

  router.get(
    "/email-addresses",
    zValidator("query", listEmailAddressesQuerySchema),
    async c => {
      const organizationId = c.get("organizationId");
      const query = c.req.valid("query");
      const result = await listEmailAddresses({
        env: c.env,
        organizationId,
        queryPayload: query,
      });
      return c.json(result, 200, { "Cache-Control": "private, max-age=15" });
    }
  );

  router.post(
    "/email-addresses",
    zValidator("json", createEmailAddressBodySchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: "invalid request body" }, 400);
      }
      return undefined;
    }),
    async c => {
      const session = c.get("session");
      const organizationId = c.get("organizationId");
      const payload = c.req.valid("json");

      const result = await createEmailAddress({
        env: c.env,
        session,
        organizationId,
        payload,
      });

      return c.json(result.body, result.status, {
        "Cache-Control": "private, max-age=15",
      });
    }
  );

  router.delete("/email-addresses/:id", async c => {
    const organizationId = c.get("organizationId");
    const addressId = c.req.param("id");

    const result = await deleteEmailAddress({
      env: c.env,
      organizationId,
      addressId,
    });

    return c.json(result.body, result.status);
  });

  router.patch(
    "/email-addresses/:id",
    zValidator("json", updateEmailAddressBodySchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: "invalid request body" }, 400);
      }
      return undefined;
    }),
    async c => {
      const organizationId = c.get("organizationId");
      const addressId = c.req.param("id");
      const payload = c.req.valid("json");

      const result = await updateEmailAddress({
        env: c.env,
        organizationId,
        addressId,
        payload,
      });

      return c.json(result.body, result.status);
    }
  );

  return router;
};
