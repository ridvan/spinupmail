import type { Hono } from "hono";
import type { IncomingRequestCfProperties } from "@cloudflare/workers-types";
import type { AppHonoEnv } from "@/app/types";
import { createAuth } from "@/platform/auth/create-auth";

export const registerAuthInitializationMiddleware = (app: Hono<AppHonoEnv>) => {
  app.use("*", async (c, next) => {
    const cf =
      ("cf" in c.req.raw
        ? (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf
        : undefined) ?? ({} as IncomingRequestCfProperties);

    const auth = createAuth(c.env, cf, c.executionCtx);
    c.set("auth", auth);
    await next();
  });
};
