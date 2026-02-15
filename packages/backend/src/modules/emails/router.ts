import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppHonoEnv } from "@/app/types";
import {
  deleteEmail,
  getEmailAttachment,
  getEmailDetail,
  getEmailRaw,
  listEmails,
} from "./service";
import { emailDetailQuerySchema, listEmailsQuerySchema } from "./schemas";

export const createEmailsRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.get("/emails", zValidator("query", listEmailsQuerySchema), async c => {
    const organizationId = c.get("organizationId");
    const query = c.req.valid("query");

    const result = await listEmails({
      env: c.env,
      organizationId,
      queryPayload: query,
    });

    return c.json(result.body, result.status, {
      "Cache-Control": "private, max-age=5",
    });
  });

  router.delete("/emails/:id", async c => {
    const organizationId = c.get("organizationId");
    const emailId = c.req.param("id");

    const result = await deleteEmail({
      env: c.env,
      organizationId,
      emailId,
    });

    return c.json(result.body, result.status);
  });

  router.get(
    "/emails/:id",
    zValidator("query", emailDetailQuerySchema),
    async c => {
      const organizationId = c.get("organizationId");
      const emailId = c.req.param("id");
      const query = c.req.valid("query");

      const result = await getEmailDetail({
        env: c.env,
        organizationId,
        emailId,
        queryPayload: query,
      });

      return c.json(result.body, result.status, {
        "Cache-Control": "private, max-age=5",
      });
    }
  );

  router.get("/emails/:id/raw", async c => {
    const organizationId = c.get("organizationId");
    const emailId = c.req.param("id");
    return getEmailRaw({ env: c.env, organizationId, emailId });
  });

  router.get("/emails/:id/attachments/:attachmentId", async c => {
    const organizationId = c.get("organizationId");
    const emailId = c.req.param("id");
    const attachmentId = c.req.param("attachmentId");

    return getEmailAttachment({
      env: c.env,
      organizationId,
      emailId,
      attachmentId,
    });
  });

  return router;
};
