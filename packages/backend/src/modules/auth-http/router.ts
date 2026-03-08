import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppHonoEnv } from "@/app/types";
import { handleAuthRequest } from "./handler";
import { resendVerificationSchema } from "./schemas";
import { resendVerificationEmail } from "./service";

export const createAuthHttpRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.post(
    "/auth/resend-verification",
    zValidator("json", resendVerificationSchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: "valid email is required" }, 400);
      }
      return undefined;
    }),
    async c => {
      const payload = c.req.valid("json");
      return resendVerificationEmail(c, payload);
    }
  );

  router.all("/auth/*", handleAuthRequest);

  return router;
};
