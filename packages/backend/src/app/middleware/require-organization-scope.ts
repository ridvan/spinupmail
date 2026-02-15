import type { MiddlewareHandler } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { getAuthFailureResponse } from "@/shared/errors";

const getSessionActiveOrganizationId = (
  session: AppHonoEnv["Variables"]["session"]
) => {
  const value = (
    session.session as typeof session.session & {
      activeOrganizationId?: string | null;
    }
  ).activeOrganizationId;

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const requireOrganizationScope: MiddlewareHandler<AppHonoEnv> = async (
  c,
  next
) => {
  const auth = c.get("auth");
  const authApi = auth.api as typeof auth.api & {
    getFullOrganization: (args: {
      headers: Headers;
      query: { organizationId: string; membersLimit: number };
    }) => Promise<{ id?: string | null } | null>;
  };
  const session = c.get("session");
  const headerOrganizationId = c.req.header("x-org-id")?.trim() || null;
  const isApiKeyRequest = Boolean(c.req.header("x-api-key"));

  if (isApiKeyRequest && !headerOrganizationId) {
    c.status(400);
    return c.json({ error: "x-org-id header is required for api key usage" });
  }

  const organizationId =
    headerOrganizationId ?? getSessionActiveOrganizationId(session);

  if (!organizationId) {
    c.status(400);
    return c.json({ error: "active organization is required" });
  }

  try {
    const organization = await authApi.getFullOrganization({
      headers: c.req.raw.headers,
      query: {
        organizationId,
        membersLimit: 1,
      },
    });

    if (!organization?.id) {
      c.status(403);
      return c.json({ error: "forbidden" });
    }
  } catch (error) {
    const authFailure = getAuthFailureResponse(error);
    if (authFailure) {
      c.status(authFailure.status);
      return c.json({ error: authFailure.error });
    }

    c.status(403);
    return c.json({ error: "forbidden" });
  }

  c.set("organizationId", organizationId);
  await next();
};
