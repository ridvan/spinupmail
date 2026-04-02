import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppHonoEnv } from "@/app/types";
import { requireAuth } from "@/app/middleware/require-auth";
import { handleAuthRequest } from "./handler";
import {
  requestPasswordSetupLinkSchema,
  resendVerificationSchema,
} from "./schemas";
import { requestPasswordSetupLink, resendVerificationEmail } from "./service";

const toAllowedOrigin = (value: string | undefined) => {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

const isAllowedPasswordSetupCallbackURL = (
  c: {
    req: {
      header(name: string): string | undefined;
    };
    env?: {
      CORS_ORIGIN?: string;
      BETTER_AUTH_BASE_URL?: string;
    };
  },
  callbackURL: string
) => {
  const callbackOrigin = toAllowedOrigin(callbackURL);
  if (!callbackOrigin) return false;

  const allowedOrigins = new Set<string>();
  const env = c.env;
  const requestOrigin = toAllowedOrigin(c.req.header("origin"));
  if (requestOrigin) {
    allowedOrigins.add(requestOrigin);
  }

  for (const origin of env?.CORS_ORIGIN?.split(",") ?? []) {
    const allowedOrigin = toAllowedOrigin(origin.trim());
    if (allowedOrigin) {
      allowedOrigins.add(allowedOrigin);
    }
  }

  const authOrigin = toAllowedOrigin(env?.BETTER_AUTH_BASE_URL?.trim());
  if (authOrigin) {
    allowedOrigins.add(authOrigin);
  }

  return allowedOrigins.has(callbackOrigin);
};

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

  router.post(
    "/auth/password-setup-link",
    requireAuth,
    zValidator("json", requestPasswordSetupLinkSchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: "invalid password setup request" }, 400);
      }
      if (
        result.data.callbackURL &&
        !isAllowedPasswordSetupCallbackURL(c, result.data.callbackURL)
      ) {
        return c.json({ error: "invalid password setup request" }, 400);
      }
      return undefined;
    }),
    async c => {
      const payload = c.req.valid("json");
      return requestPasswordSetupLink(c, payload);
    }
  );

  router.all("/auth/*", handleAuthRequest);

  return router;
};
