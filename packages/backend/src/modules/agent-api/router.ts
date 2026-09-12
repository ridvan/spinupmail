import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { ZodError } from "zod";
import type { AppHonoEnv } from "@/app/types";
import { requireAgentAuth } from "./auth";
import { AgentError } from "./core";
import { createAgentEnrollmentRouter } from "./enrollment";
import { createAgentIdentityRouter } from "./identity";
import { createAgentInboxesRouter } from "./inboxes";
import { createAgentMessagesRouter } from "./messages";
import { createAgentFilesRouter } from "./files";
import { createAgentEventsRouter } from "./events";
import { createAgentDraftsRouter } from "./drafts";
import { createAgentSendingPolicyRouter } from "./sending-policy";
import { createAgentSendingRouter } from "./sending";
import { createAgentProviderEventsRouter } from "./provider-events";
import { createAgentUsageRouter } from "./usage";
import { createAgentDiscoveryRouter } from "./discovery";
import { createAgentOperatorRouter } from "./operator";

export const createAgentApiRouter = () => {
  const router = new Hono<AppHonoEnv>();
  router.use(
    "*",
    bodyLimit({
      maxSize: 1024 * 1024,
      onError: () => {
        throw new AgentError("payload_too_large", "Request exceeds 1 MiB", 413);
      },
    })
  );
  router.use("*", async (c, next) => {
    const requestId =
      c.req.header("X-Request-Id")?.trim() || crypto.randomUUID();
    c.set("requestId", requestId.slice(0, 128));
    c.header("X-Request-Id", requestId.slice(0, 128));
    c.header("Cache-Control", "no-store");
    await next();
  });
  router.onError((error, c) => {
    const known = error instanceof AgentError;
    const invalid = error instanceof ZodError;
    return c.json(
      {
        error: {
          code: known
            ? error.code
            : invalid
              ? "validation_error"
              : "internal_error",
          message: known
            ? error.message
            : invalid
              ? "Invalid request parameters"
              : "Request could not be completed",
          requestId: c.get("requestId") || crypto.randomUUID(),
        },
      },
      known ? error.status : invalid ? 400 : 500
    );
  });
  router.route("/", createAgentDiscoveryRouter());
  router.use("*", requireAgentAuth);
  router.get("/capabilities", c => {
    const actor = c.get("agentActor");
    return c.json({
      version: "1",
      organizationId: actor.organizationId,
      actor: actor.kind,
      admin: actor.admin,
      platformAdmin: actor.platformAdmin ?? false,
      twoFactorEnabled: actor.twoFactorEnabled,
      capabilities: actor.capabilities,
      sending: false,
    });
  });
  router.route("/", createAgentEnrollmentRouter());
  router.route("/", createAgentIdentityRouter());
  router.route("/", createAgentInboxesRouter());
  router.route("/", createAgentMessagesRouter());
  router.route("/", createAgentFilesRouter());
  router.route("/", createAgentEventsRouter());
  router.route("/", createAgentDraftsRouter());
  router.route("/", createAgentSendingPolicyRouter());
  router.route("/", createAgentSendingRouter());
  router.route("/", createAgentProviderEventsRouter());
  router.route("/", createAgentUsageRouter());
  router.route("/", createAgentOperatorRouter());
  return router;
};
