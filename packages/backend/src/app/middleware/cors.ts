import type { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppHonoEnv } from "@/app/types";
import { getAllowedOrigins } from "@/shared/env";

export const registerCorsMiddleware = (app: Hono<AppHonoEnv>) => {
  app.use(
    "/api/*",
    cors({
      origin: (origin, c) => {
        if (!origin) return null;
        const allowed = getAllowedOrigins(c.env);
        return allowed.includes(origin) ? origin : null;
      },
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "X-Org-Id",
        "X-Captcha-Response",
      ],
      allowMethods: ["POST", "GET", "OPTIONS", "DELETE"],
      exposeHeaders: ["Content-Length", "Content-Disposition", "Content-Type"],
      maxAge: 600,
      credentials: true,
    })
  );
};
