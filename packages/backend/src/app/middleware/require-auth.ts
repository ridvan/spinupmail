import type { MiddlewareHandler } from "hono";
import type { AppHonoEnv, AuthSession } from "@/app/types";
import { getAuthFailureResponse } from "@/shared/errors";

const toAuthSession = (value: unknown): AuthSession | null => {
  if (!value || typeof value !== "object") return null;

  const candidate = value as {
    session?: Record<string, unknown>;
    user?: Record<string, unknown>;
  };

  const session = candidate.session;
  const user = candidate.user;

  if (!session || typeof session !== "object") return null;
  if (!user || typeof user !== "object") return null;
  if (typeof session.id !== "string" || session.id.length === 0) return null;
  if (typeof user.id !== "string" || user.id.length === 0) return null;

  return {
    session: session as AuthSession["session"],
    user: user as AuthSession["user"],
  };
};

export const requireAuth: MiddlewareHandler<AppHonoEnv> = async (c, next) => {
  const auth = c.get("auth");

  try {
    const rawSession = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    const session = toAuthSession(rawSession);

    if (!session) {
      c.status(401);
      return c.json({ error: "unauthorized" });
    }

    if (session.user.emailVerified !== true) {
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
