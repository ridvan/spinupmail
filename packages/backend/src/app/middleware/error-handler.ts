import type { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";

export const registerErrorHandling = (app: Hono<AppHonoEnv>) => {
  app.onError((error, c) => {
    console.error("[api] Unhandled route error", error);
    return c.json({ error: "internal server error" }, 500);
  });

  app.notFound(c => c.json({ error: "not found" }, 404));
};
