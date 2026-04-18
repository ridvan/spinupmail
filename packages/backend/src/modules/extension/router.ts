import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  extensionAcceptInvitationRequestSchema,
  extensionAuthExchangeRequestSchema,
} from "@spinupmail/contracts";
import type { AppHonoEnv } from "@/app/types";
import {
  acceptExtensionInvitation,
  buildExtensionBootstrap,
  createGoogleExtensionCompleteRedirect,
  createGoogleExtensionStartUrl,
  exchangeExtensionCode,
  getExtensionInvitation,
} from "./service";

const extensionRedirectQuerySchema = z.object({
  redirectUri: z.string().url(),
});

const extensionCallbackQuerySchema = extensionRedirectQuerySchema.extend({
  error: z.string().optional(),
});

const appendResponseHeaders = (target: Headers, source: Headers | null) => {
  if (!source) return;

  const getSetCookie = (
    source as Headers & {
      getSetCookie?: () => string[];
    }
  ).getSetCookie;

  const setCookies =
    typeof getSetCookie === "function" ? getSetCookie.call(source) : [];

  for (const value of setCookies) {
    target.append("set-cookie", value);
  }

  source.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      if (setCookies.length === 0) {
        target.append(key, value);
      }
      return;
    }

    target.set(key, value);
  });
};

export const createExtensionRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.get(
    "/extension/auth/google/start",
    zValidator("query", extensionRedirectQuerySchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: "invalid extension redirect uri" }, 400);
      }
      return undefined;
    }),
    async c => {
      const query = c.req.valid("query");

      try {
        const { headers, redirectUrl } = await createGoogleExtensionStartUrl({
          env: c.env,
          auth: c.get("auth"),
          headers: c.req.raw.headers,
          redirectUri: query.redirectUri,
        });

        const response = c.redirect(redirectUrl, 302);
        appendResponseHeaders(response.headers, headers);
        return response;
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Unable to start Google sign in",
          },
          400
        );
      }
    }
  );

  router.get(
    "/extension/auth/google/callback",
    zValidator("query", extensionCallbackQuerySchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: "invalid extension redirect uri" }, 400);
      }
      return undefined;
    }),
    async c => {
      const query = c.req.valid("query");

      try {
        const url = await createGoogleExtensionCompleteRedirect({
          env: c.env,
          auth: c.get("auth"),
          headers: c.req.raw.headers,
          redirectUri: query.redirectUri,
          error: query.error,
        });

        return c.redirect(url, 302);
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Unable to complete Google sign in",
          },
          400
        );
      }
    }
  );

  router.post(
    "/extension/auth/google/exchange",
    zValidator("json", extensionAuthExchangeRequestSchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: "invalid extension exchange request" }, 400);
      }
      return undefined;
    }),
    async c => {
      const payload = c.req.valid("json");
      const exchange = await exchangeExtensionCode({
        env: c.env,
        code: payload.code,
      });

      if (!exchange) {
        return c.json(
          { error: "invalid or expired extension exchange code" },
          400
        );
      }

      return c.json(exchange, 200, {
        "Cache-Control": "no-store",
      });
    }
  );

  router.get("/extension/bootstrap", async c => {
    const bootstrap = await buildExtensionBootstrap({
      auth: c.get("auth"),
      headers: c.req.raw.headers,
      organizationIdHint: c.req.header("x-org-id")?.trim() || null,
    });

    return c.json(bootstrap, 200, {
      "Cache-Control": "private, no-store",
    });
  });

  router.post(
    "/extension/invitations/accept",
    zValidator("json", extensionAcceptInvitationRequestSchema, (result, c) => {
      if (!result.success) {
        return c.json({ error: "invalid invitation accept request" }, 400);
      }
      return undefined;
    }),
    async c => {
      const payload = c.req.valid("json");
      const bootstrap = await acceptExtensionInvitation({
        auth: c.get("auth"),
        headers: c.req.raw.headers,
        invitationId: payload.invitationId,
      });

      return c.json(bootstrap, 200, {
        "Cache-Control": "private, no-store",
      });
    }
  );

  router.get("/extension/invitations/:id", async c => {
    const invitationId = c.req.param("id");
    const invitation = await getExtensionInvitation({
      auth: c.get("auth"),
      headers: c.req.raw.headers,
      invitationId,
    });

    if (!invitation) {
      return c.json({ error: "invitation not found" }, 404);
    }

    return c.json(invitation, 200, {
      "Cache-Control": "private, no-store",
    });
  });

  return router;
};
