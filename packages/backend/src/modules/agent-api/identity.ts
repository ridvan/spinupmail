import { agentCapabilitySchema } from "@spinupmail/contracts";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import {
  AgentError,
  auditStatement,
  requestIdFor,
  requireHumanAdmin,
} from "./core";

type CredentialListRow = {
  id: string;
  organization_id: string;
  principal_id: string;
  name: string;
  created_at: number;
  expires_at: number;
  revoked_at: number | null;
};

export const createAgentIdentityRouter = () => {
  const router = new Hono<AppHonoEnv>();
  router.use("/agents", async (c, next) => {
    requireHumanAdmin(c.get("agentActor"));
    await next();
  });
  router.use("/agents/*", async (c, next) => {
    requireHumanAdmin(c.get("agentActor"));
    await next();
  });
  router.use("/credentials", async (c, next) => {
    requireHumanAdmin(c.get("agentActor"));
    await next();
  });
  router.use("/credentials/*", async (c, next) => {
    requireHumanAdmin(c.get("agentActor"));
    await next();
  });

  router.get("/agents", async c => {
    const actor = c.get("agentActor");
    const rows = await c.env.SUM_DB.prepare(
      `SELECT id, organization_id AS organizationId, name,
      created_at AS createdAt, revoked_at AS revokedAt
      FROM agent_principals WHERE organization_id = ?
      ORDER BY created_at DESC, id DESC LIMIT 100`
    )
      .bind(actor.organizationId)
      .all();
    return c.json({ items: rows.results });
  });

  router.delete("/agents/:id", async c => {
    const actor = c.get("agentActor");
    const id = c.req.param("id");
    const result = await c.env.SUM_DB.batch([
      c.env.SUM_DB.prepare(
        `UPDATE agent_principals SET revoked_at = ?
        WHERE organization_id = ? AND id = ? AND revoked_at IS NULL`
      ).bind(Date.now(), actor.organizationId, id),
      auditStatement(
        c.env.SUM_DB,
        actor,
        requestIdFor(c),
        "agent.revoked",
        "agent",
        id
      ),
    ]);
    if ((result[0].meta.changes ?? 0) === 0) {
      throw new AgentError("not_found", "Agent not found", 404);
    }
    return c.body(null, 204);
  });

  router.get("/credentials", async c => {
    const actor = c.get("agentActor");
    const credentials = await c.env.SUM_DB.prepare(
      `SELECT id, organization_id, principal_id, name, created_at,
      expires_at, revoked_at FROM agent_credentials
      WHERE organization_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`
    )
      .bind(actor.organizationId)
      .all<CredentialListRow>();
    const items = await Promise.all(
      credentials.results.map(async credential => {
        const [capabilities, grants] = await c.env.SUM_DB.batch([
          c.env.SUM_DB.prepare(
            `SELECT capability FROM agent_credential_capabilities
            WHERE organization_id = ? AND credential_id = ? ORDER BY capability`
          ).bind(actor.organizationId, credential.id),
          c.env.SUM_DB.prepare(
            `SELECT inbox_id FROM agent_inbox_grants
            WHERE organization_id = ? AND credential_id = ? ORDER BY inbox_id`
          ).bind(actor.organizationId, credential.id),
        ]);
        return {
          id: credential.id,
          organizationId: credential.organization_id,
          principalId: credential.principal_id,
          name: credential.name,
          capabilities: capabilities.results.map(row =>
            agentCapabilitySchema.parse(
              (row as { capability: unknown }).capability
            )
          ),
          inboxIds: grants.results.map(
            row => (row as { inbox_id: string }).inbox_id
          ),
          createdAt: credential.created_at,
          expiresAt: credential.expires_at,
          revokedAt: credential.revoked_at,
        };
      })
    );
    return c.json({ items });
  });

  router.delete("/credentials/:id", async c => {
    const actor = c.get("agentActor");
    const id = c.req.param("id");
    const result = await c.env.SUM_DB.batch([
      c.env.SUM_DB.prepare(
        `UPDATE agent_credentials SET revoked_at = ?
        WHERE organization_id = ? AND id = ? AND revoked_at IS NULL`
      ).bind(Date.now(), actor.organizationId, id),
      auditStatement(
        c.env.SUM_DB,
        actor,
        requestIdFor(c),
        "credential.revoked",
        "credential",
        id
      ),
    ]);
    if ((result[0].meta.changes ?? 0) === 0) {
      throw new AgentError("not_found", "Credential not found", 404);
    }
    return c.body(null, 204);
  });

  return router;
};
