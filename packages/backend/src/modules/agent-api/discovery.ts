import {
  createAgentLlmsText,
  createAgentOpenApiDocument,
} from "@spinupmail/contracts";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";

const publicHeaders = {
  "Cache-Control": "public, max-age=300",
  "Access-Control-Allow-Origin": "*",
};

export const createAgentDiscoveryRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.get("/discovery", c => {
    const origin = new URL(c.req.url).origin;
    return c.json(
      {
        name: "SpinupMail Agent Inbox API",
        version: "v1",
        openapi: `${origin}/api/v1/openapi.json`,
        llms: `${origin}/api/v1/llms.txt`,
        authentication: {
          agent: "Authorization: Bearer $SPINUPMAIL_AGENT_CREDENTIAL",
          enrollment: "One-use enrollment token in the enrollment request body",
        },
        outboundSendingDefault: false,
      },
      200,
      publicHeaders
    );
  });
  router.get("/openapi.json", c =>
    c.json(createAgentOpenApiDocument(), 200, {
      ...publicHeaders,
      "Content-Type": "application/vnd.oai.openapi+json; charset=utf-8",
    })
  );
  router.get("/llms.txt", c =>
    c.text(createAgentLlmsText(), 200, {
      ...publicHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    })
  );
  return router;
};
