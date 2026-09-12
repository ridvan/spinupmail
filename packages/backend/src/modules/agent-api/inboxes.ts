import {
  agentCreateInboxRequestSchema,
  agentListQuerySchema,
} from "@spinupmail/contracts";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { getAllowedDomains } from "@/shared/env";
import { normalizeAddress } from "@/shared/validation";
import {
  AgentError,
  auditStatement,
  decodeCursor,
  encodeCursor,
  inboxAllowed,
  jsonInput,
  requestIdFor,
  requireCapability,
  type AgentActor,
} from "./core";
import {
  abandonIdempotency,
  claimIdempotency,
  completeIdempotencyStatement,
  requireIdempotencyKey,
} from "./idempotency";

type InboxInput = { id: string; localPart: string; domain: string };

export const validateAgentInboxAddress = (
  env: CloudflareBindings,
  input: Pick<InboxInput, "localPart" | "domain">
) => {
  const allowedDomains = getAllowedDomains(env);
  if (!allowedDomains.includes(input.domain)) {
    throw new AgentError(
      "domain_not_allowed",
      "The requested inbox domain is not enabled",
      403
    );
  }
  return normalizeAddress(`${input.localPart}@${input.domain}`);
};

export const prepareAgentInboxCreation = async (args: {
  db: D1Database;
  env: CloudflareBindings;
  organizationId: string;
  principalId: string;
  credentialId: string;
  userId: string;
  inboxLimit: number;
  input: InboxInput;
  now: number;
}) => {
  const address = validateAgentInboxAddress(args.env, args.input);
  const conflict = await args.db
    .prepare(
      `SELECT 1 AS found FROM email_addresses WHERE address = ?
      UNION ALL SELECT 1 AS found FROM agent_address_tombstones WHERE address = ?
      LIMIT 1`
    )
    .bind(address, address)
    .first();
  if (conflict) {
    throw new AgentError(
      "address_unavailable",
      "Inbox address is unavailable",
      409
    );
  }
  const count = await args.db
    .prepare(
      `SELECT count(*) AS value FROM agent_inboxes
      WHERE organization_id = ? AND principal_id = ? AND deleted_at IS NULL`
    )
    .bind(args.organizationId, args.principalId)
    .first<{ value: number }>();
  if (Number(count?.value ?? 0) >= args.inboxLimit) {
    throw new AgentError("inbox_limit", "Enrollment inbox limit reached", 429);
  }

  const response = {
    id: args.input.id,
    organizationId: args.organizationId,
    principalId: args.principalId,
    address,
    localPart: args.input.localPart,
    domain: args.input.domain,
    createdAt: args.now,
    deletedAt: null,
  };
  const statements = [
    args.db
      .prepare(
        `INSERT INTO email_addresses
        (id, organization_id, user_id, address, local_part, domain, meta,
         email_count, created_at, auto_created)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0)`
      )
      .bind(
        args.input.id,
        args.organizationId,
        args.userId,
        address,
        args.input.localPart,
        args.input.domain,
        JSON.stringify({ agentPersistent: true }),
        args.now
      ),
    args.db
      .prepare(
        `INSERT INTO agent_inboxes
        (id, organization_id, principal_id, created_at)
        SELECT ?, ?, ?, ? WHERE (
          SELECT count(*) FROM agent_inboxes
          WHERE organization_id = ? AND principal_id = ? AND deleted_at IS NULL
        ) < ?`
      )
      .bind(
        args.input.id,
        args.organizationId,
        args.principalId,
        args.now,
        args.organizationId,
        args.principalId,
        args.inboxLimit
      ),
    args.db
      .prepare(
        `INSERT INTO agent_inbox_grants
        (organization_id, credential_id, inbox_id, created_at)
        VALUES (?, ?, ?, ?)`
      )
      .bind(args.organizationId, args.credentialId, args.input.id, args.now),
  ];
  return { response, statements };
};

export const requireAccessibleInbox = async (
  db: D1Database,
  actor: AgentActor,
  inboxId: string
) => {
  const inbox = await db
    .prepare(
      `SELECT id, organization_id FROM agent_inboxes
      WHERE organization_id = ? AND id = ? AND deleted_at IS NULL`
    )
    .bind(actor.organizationId, inboxId)
    .first<{ id: string; organization_id: string }>();
  if (!inbox || !inboxAllowed(actor, inbox)) {
    throw new AgentError("not_found", "Inbox not found", 404);
  }
  return inbox;
};

export const createAgentInboxesRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.post("/inboxes", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "inboxes:create");
    if (actor.kind !== "agent" || !actor.credentialId) {
      throw new AgentError(
        "agent_credential_required",
        "An agent credential is required",
        403
      );
    }
    const input = await jsonInput(c, agentCreateInboxRequestSchema);
    const key = requireIdempotencyKey(c);
    const claim = await claimIdempotency<{ inbox: unknown }>({
      db: c.env.SUM_DB,
      organizationId: actor.organizationId,
      actorId: actor.credentialId,
      operation: "inboxes.create",
      key,
      input,
    });
    if (claim.kind === "replay") return c.json(claim.response, 200);

    const credential = await c.env.SUM_DB.prepare(
      `SELECT c.inbox_limit, p.created_by_user_id
      FROM agent_credentials c JOIN agent_principals p
        ON p.organization_id = c.organization_id AND p.id = c.principal_id
      WHERE c.organization_id = ? AND c.id = ?`
    )
      .bind(actor.organizationId, actor.credentialId)
      .first<{ inbox_limit: number; created_by_user_id: string | null }>();
    if (!credential?.created_by_user_id) {
      await abandonIdempotency(c.env.SUM_DB, claim.id);
      throw new AgentError(
        "inbox_unavailable",
        "Inbox owner is unavailable",
        503
      );
    }

    try {
      const created = await prepareAgentInboxCreation({
        db: c.env.SUM_DB,
        env: c.env,
        organizationId: actor.organizationId,
        principalId: actor.id,
        credentialId: actor.credentialId,
        userId: credential.created_by_user_id,
        inboxLimit: credential.inbox_limit,
        input,
        now: Date.now(),
      });
      const response = { inbox: created.response };
      await c.env.SUM_DB.batch([
        ...created.statements,
        auditStatement(
          c.env.SUM_DB,
          actor,
          requestIdFor(c),
          "inbox.created",
          "inbox",
          input.id,
          { address: created.response.address }
        ),
        completeIdempotencyStatement(
          c.env.SUM_DB,
          claim.id,
          "inbox",
          input.id,
          response
        ),
      ]);
      return c.json(response, 201);
    } catch (error) {
      await abandonIdempotency(c.env.SUM_DB, claim.id);
      throw error;
    }
  });

  router.get("/inboxes", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "inboxes:read");
    const query = agentListQuerySchema.parse(c.req.query());
    const cursor = decodeCursor(query.cursor);
    const grantFilter =
      actor.kind === "agent"
        ? `AND EXISTS (
          SELECT 1 FROM agent_inbox_grants g
          WHERE g.organization_id = i.organization_id AND g.inbox_id = i.id
            AND g.credential_id = ?
        )`
        : "";
    const statement = c.env.SUM_DB.prepare(
      `SELECT i.id, i.organization_id AS organizationId,
      i.principal_id AS principalId, a.address, a.local_part AS localPart,
      a.domain, i.created_at AS createdAt, i.deleted_at AS deletedAt
      FROM agent_inboxes i JOIN email_addresses a
        ON a.organization_id = i.organization_id AND a.id = i.id
      WHERE i.organization_id = ? AND i.deleted_at IS NULL
      ${grantFilter}
      ${cursor ? "AND (i.created_at < ? OR (i.created_at = ? AND i.id < ?))" : ""}
      ORDER BY i.created_at DESC, i.id DESC LIMIT ?`
    );
    const bindings: unknown[] = [actor.organizationId];
    if (actor.kind === "agent") bindings.push(actor.credentialId);
    if (cursor) bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
    bindings.push(query.limit + 1);
    const rows = await statement
      .bind(...bindings)
      .all<Record<string, unknown>>();
    const hasMore = rows.results.length > query.limit;
    const items = hasMore ? rows.results.slice(0, query.limit) : rows.results;
    const last = items.at(-1) as
      { createdAt?: number; id?: string } | undefined;
    return c.json({
      items,
      nextCursor:
        hasMore && last?.createdAt !== undefined && last.id
          ? encodeCursor(last.createdAt, last.id)
          : null,
    });
  });

  router.delete("/inboxes/:id", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "inboxes:delete");
    const id = c.req.param("id");
    await requireAccessibleInbox(c.env.SUM_DB, actor, id);
    const row = await c.env.SUM_DB.prepare(
      "SELECT address FROM email_addresses WHERE organization_id = ? AND id = ?"
    )
      .bind(actor.organizationId, id)
      .first<{ address: string }>();
    if (!row) throw new AgentError("not_found", "Inbox not found", 404);
    const now = Date.now();
    await c.env.SUM_DB.batch([
      c.env.SUM_DB.prepare(
        `INSERT OR IGNORE INTO agent_address_tombstones
        (address, organization_id, inbox_id, deleted_at) VALUES (?, ?, ?, ?)`
      ).bind(row.address, actor.organizationId, id, now),
      c.env.SUM_DB.prepare(
        `UPDATE agent_inboxes SET deleted_at = ?
        WHERE organization_id = ? AND id = ? AND deleted_at IS NULL`
      ).bind(now, actor.organizationId, id),
      c.env.SUM_DB.prepare(
        `UPDATE email_addresses SET expires_at = ?
        WHERE organization_id = ? AND id = ?`
      ).bind(now, actor.organizationId, id),
      auditStatement(
        c.env.SUM_DB,
        actor,
        requestIdFor(c),
        "inbox.deleted",
        "inbox",
        id
      ),
    ]);
    return c.body(null, 204);
  });

  return router;
};
