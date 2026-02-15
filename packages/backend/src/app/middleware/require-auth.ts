import type { MiddlewareHandler } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { getAuthFailureResponse } from "@/shared/errors";

export const requireAuth: MiddlewareHandler<AppHonoEnv> = async (c, next) => {
  const auth = c.get("auth");

  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.session || !session?.user) {
      c.status(401);
      return c.json({ error: "unauthorized" });
    }

    if (
      (
        session.user as typeof session.user & {
          emailVerified?: boolean | null;
        }
      ).emailVerified !== true
    ) {
      c.status(403);
      return c.json({ error: "email verification required" });
    }

    c.set("session", session);
    await next();
  } catch (error) {
    const authFailure = getAuthFailureResponse(error);
    if (authFailure) {
      c.status(authFailure.status);
      return c.json({ error: authFailure.error });
    }
    throw error;
  }
};
