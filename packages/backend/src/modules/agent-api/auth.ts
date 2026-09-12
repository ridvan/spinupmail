import {
  agentCapabilitySchema,
  agentCredentialTokenSchema,
  isPlatformAdminRole,
} from "@spinupmail/contracts";
import type { MiddlewareHandler } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { AgentError, digestSecret, type AgentActor } from "./core";

const parseCredentialToken = (token: string) => {
  const parsed = agentCredentialTokenSchema.safeParse(token);
  if (!parsed.success) {
    throw new AgentError("unauthorized", "Invalid agent credential", 401);
  }
  const separator = token.indexOf(".");
  return {
    credentialId: token.slice("smai_v1_".length, separator),
    secret: token.slice(separator + 1),
  };
};

export const authenticateAgentToken = async (
  db: D1Database,
  token: string,
  now = Date.now()
): Promise<AgentActor> => {
  const { credentialId, secret } = parseCredentialToken(token);
  const row = await db
    .prepare(
      `SELECT c.id AS credential_id, c.organization_id, c.principal_id
      FROM agent_credentials c
      JOIN agent_principals p
        ON p.organization_id = c.organization_id AND p.id = c.principal_id
      JOIN organizations o ON o.id = c.organization_id
      WHERE c.id = ? AND c.secret_hash = ?
        AND c.revoked_at IS NULL AND p.revoked_at IS NULL AND c.expires_at > ?`
    )
    .bind(credentialId, await digestSecret(secret), now)
    .first<{
      credential_id: string;
      organization_id: string;
      principal_id: string;
    }>();

  if (!row) {
    throw new AgentError(
      "unauthorized",
      "Expired or revoked agent credential",
      401
    );
  }

  const [capabilitiesResult, grantsResult] = await db.batch([
    db
      .prepare(
        `SELECT capability FROM agent_credential_capabilities
        WHERE organization_id = ? AND credential_id = ? ORDER BY capability`
      )
      .bind(row.organization_id, row.credential_id),
    db
      .prepare(
        `SELECT inbox_id FROM agent_inbox_grants
        WHERE organization_id = ? AND credential_id = ? ORDER BY inbox_id`
      )
      .bind(row.organization_id, row.credential_id),
  ]);

  return {
    id: row.principal_id,
    organizationId: row.organization_id,
    kind: "agent",
    admin: false,
    twoFactorEnabled: false,
    credentialId: row.credential_id,
    capabilities: capabilitiesResult.results.map(item =>
      agentCapabilitySchema.parse((item as { capability: unknown }).capability)
    ),
    inboxIds: grantsResult.results.map(
      item => (item as { inbox_id: string }).inbox_id
    ),
  };
};

const authenticateHuman = async (
  c: Parameters<MiddlewareHandler<AppHonoEnv>>[0]
): Promise<AgentActor> => {
  const session = await c
    .get("auth")
    .api.getSession({ headers: c.req.raw.headers });
  if (!session?.user?.id) {
    throw new AgentError("unauthorized", "Authentication required", 401);
  }

  const organizationId =
    c.req.header("X-Org-Id")?.trim() ||
    (
      session.session as { activeOrganizationId?: string | null }
    ).activeOrganizationId?.trim();
  if (!organizationId) {
    throw new AgentError(
      "organization_required",
      "An active organization is required"
    );
  }

  const member = await c.env.SUM_DB.prepare(
    `SELECT m.role, u.email_verified, u.two_factor_enabled, u.role AS platform_role
    FROM members m JOIN users u ON u.id = m.user_id
    WHERE m.organization_id = ? AND m.user_id = ?
      AND u.email_verified = 1
      AND (u.banned IS NULL OR u.banned = 0 OR u.ban_expires <= ?)`
  )
    .bind(organizationId, session.user.id, Date.now())
    .first<{
      role: string;
      email_verified: number;
      two_factor_enabled: number | null;
      platform_role: string | null;
    }>();
  if (!member) {
    throw new AgentError(
      "forbidden",
      "Verified organization membership is required",
      403
    );
  }

  const legacy = Boolean(c.req.header("X-API-Key"));
  return {
    id: session.user.id,
    organizationId,
    kind: legacy ? "legacy" : "human",
    admin:
      !legacy &&
      member.role
        .split(",")
        .some(role => ["owner", "admin"].includes(role.trim())),
    twoFactorEnabled: !legacy && member.two_factor_enabled === 1,
    platformAdmin: !legacy && isPlatformAdminRole(member.platform_role),
    capabilities: [],
    inboxIds: [],
  };
};

export const requireAgentAuth: MiddlewareHandler<AppHonoEnv> = async (
  c,
  next
) => {
  if (
    c.req.path.endsWith("/agent/enroll") ||
    c.req.path.endsWith("/provider/events")
  ) {
    await next();
    return;
  }

  const authorization = c.req.header("Authorization");
  const actor = authorization
    ? authorization.startsWith("Bearer ")
      ? await authenticateAgentToken(c.env.SUM_DB, authorization.slice(7))
      : (() => {
          throw new AgentError(
            "unauthorized",
            "Expected a bearer credential",
            401
          );
        })()
    : await authenticateHuman(c);

  const organizationHeader = c.req.header("X-Org-Id")?.trim();
  if (
    actor.kind === "agent" &&
    organizationHeader &&
    organizationHeader !== actor.organizationId
  ) {
    throw new AgentError("forbidden", "Credential organization mismatch", 403);
  }
  c.set("agentActor", actor);
  await next();
};
