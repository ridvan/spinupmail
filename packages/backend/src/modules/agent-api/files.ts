import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { getEmailAttachment, getEmailRaw } from "@/modules/emails/service";
import { AgentError, requireCapability, type AgentContext } from "./core";
import { requireAccessibleInbox } from "./inboxes";

const requireSuccessfulFileResponse = async (response: Response) => {
  if (response.ok) return response;
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { error?: unknown } | null;
  const message =
    typeof body?.error === "string" ? body.error : "File request failed";
  if (response.status === 404) {
    throw new AgentError("not_found", message, 404);
  }
  if (response.status === 503) {
    throw new AgentError("storage_unavailable", message, 503);
  }
  throw new AgentError("file_request_failed", message, 400);
};

const authorizeMessage = async (c: AgentContext, messageId: string) => {
  const actor = c.get("agentActor");
  requireCapability(actor, "messages:read");
  const row = await c.env.SUM_DB.prepare(
    "SELECT address_id FROM emails WHERE organization_id = ? AND id = ?"
  )
    .bind(actor.organizationId, messageId)
    .first<{ address_id: string }>();
  if (!row) throw new AgentError("not_found", "Message not found", 404);
  await requireAccessibleInbox(c.env.SUM_DB, actor, row.address_id);
  return actor;
};

export const createAgentFilesRouter = () => {
  const router = new Hono<AppHonoEnv>();
  router.get("/messages/:id/raw", async c => {
    const actor = await authorizeMessage(c, c.req.param("id"));
    return requireSuccessfulFileResponse(
      await getEmailRaw({
        env: c.env,
        organizationId: actor.organizationId,
        emailId: c.req.param("id"),
      })
    );
  });
  router.get("/messages/:id/attachments/:attachmentId", async c => {
    const actor = await authorizeMessage(c, c.req.param("id"));
    return requireSuccessfulFileResponse(
      await getEmailAttachment({
        env: c.env,
        organizationId: actor.organizationId,
        emailId: c.req.param("id"),
        attachmentId: c.req.param("attachmentId"),
        queryPayload: c.req.query(),
      })
    );
  });
  return router;
};
