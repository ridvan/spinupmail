import { agentListQuerySchema } from "@spinupmail/contracts";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { decodeCursor, encodeCursor, requireCapability } from "./core";

export type AgentEventQueueMessage = {
  kind: "agent-event";
  eventId: string;
  organizationId: string;
};

export const isAgentEventQueueBatch = (
  batch: MessageBatch
): batch is MessageBatch<AgentEventQueueMessage> =>
  batch.messages.length > 0 &&
  batch.messages.every(message => {
    const body = message.body;
    return (
      typeof body === "object" &&
      body !== null &&
      "kind" in body &&
      body.kind === "agent-event"
    );
  });

export const prepareAgentEventStatements = (
  db: D1Database,
  event: {
    id: string;
    organizationId: string;
    inboxId: string | null;
    type: string;
    resourceType: string;
    resourceId: string;
    data?: Record<string, unknown>;
    createdAt: number;
  }
) => [
  db
    .prepare(
      `INSERT OR IGNORE INTO agent_events
      (id, organization_id, inbox_id, type, resource_type, resource_id, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      event.id,
      event.organizationId,
      event.inboxId,
      event.type,
      event.resourceType,
      event.resourceId,
      JSON.stringify(event.data ?? {}),
      event.createdAt
    ),
  db
    .prepare(
      `INSERT OR IGNORE INTO agent_event_outbox
      (event_id, organization_id, state, attempts, available_at)
      SELECT id, organization_id, 'pending', 0, ? FROM agent_events
      WHERE organization_id = ? AND type = ? AND resource_type = ? AND resource_id = ?`
    )
    .bind(
      event.createdAt,
      event.organizationId,
      event.type,
      event.resourceType,
      event.resourceId
    ),
];

export const publishPendingAgentEvents = async (
  env: CloudflareBindings,
  limit = 100
) => {
  if (!env.AGENT_EVENT_QUEUE) return { published: 0, pending: true };
  const rows = await env.SUM_DB.prepare(
    `SELECT o.event_id, o.organization_id FROM agent_event_outbox o
    WHERE o.state = 'pending' AND o.available_at <= ?
    ORDER BY o.available_at, o.event_id LIMIT ?`
  )
    .bind(Date.now(), limit)
    .all<{ event_id: string; organization_id: string }>();
  let published = 0;
  for (const row of rows.results) {
    try {
      await env.AGENT_EVENT_QUEUE.send({
        kind: "agent-event",
        eventId: row.event_id,
        organizationId: row.organization_id,
      } satisfies AgentEventQueueMessage);
      await env.SUM_DB.prepare(
        `UPDATE agent_event_outbox
        SET state = 'published', attempts = attempts + 1, published_at = ?, last_error = NULL
        WHERE event_id = ? AND organization_id = ?`
      )
        .bind(Date.now(), row.event_id, row.organization_id)
        .run();
      published += 1;
    } catch (error) {
      await env.SUM_DB.prepare(
        `UPDATE agent_event_outbox
        SET attempts = attempts + 1, available_at = ?, last_error = ?
        WHERE event_id = ? AND organization_id = ?`
      )
        .bind(
          Date.now() + 30_000,
          error instanceof Error ? error.message.slice(0, 500) : "queue error",
          row.event_id,
          row.organization_id
        )
        .run();
    }
  }
  return { published, pending: rows.results.length === limit };
};

export const handleAgentEventQueueBatch = async (args: {
  batch: MessageBatch<AgentEventQueueMessage>;
  env: CloudflareBindings;
}) => {
  for (const message of args.batch.messages) {
    const body = message.body;
    if (body?.kind !== "agent-event") {
      message.retry();
      continue;
    }
    const result = await args.env.SUM_DB.prepare(
      `UPDATE agent_event_outbox
      SET state = 'acknowledged', acknowledged_at = ?
      WHERE event_id = ? AND organization_id = ?`
    )
      .bind(Date.now(), body.eventId, body.organizationId)
      .run();
    if ((result.meta.changes ?? 0) > 0) message.ack();
    else message.retry();
  }
};

export const createAgentEventsRouter = () => {
  const router = new Hono<AppHonoEnv>();
  router.get("/events", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "events:read");
    const query = agentListQuerySchema.parse(c.req.query());
    const cursor = decodeCursor(query.cursor);
    const grantFilter =
      actor.kind === "agent"
        ? `AND e.inbox_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM agent_inbox_grants g
          WHERE g.organization_id = e.organization_id AND g.inbox_id = e.inbox_id
            AND g.credential_id = ?
        )`
        : "";
    const statement = c.env.SUM_DB.prepare(
      `SELECT e.id, e.type, e.inbox_id AS inboxId,
      e.resource_type AS resourceType, e.resource_id AS resourceId,
      e.data_json AS dataJson, e.created_at AS createdAt
      FROM agent_events e WHERE e.organization_id = ?
      ${grantFilter}
      ${cursor ? "AND (e.created_at > ? OR (e.created_at = ? AND e.id > ?))" : ""}
      ORDER BY e.created_at, e.id LIMIT ?`
    );
    const bindings: unknown[] = [actor.organizationId];
    if (actor.kind === "agent") bindings.push(actor.credentialId);
    if (cursor) bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
    bindings.push(query.limit + 1);
    const result = await statement.bind(...bindings).all<{
      id: string;
      type: string;
      inboxId: string | null;
      resourceType: string;
      resourceId: string;
      dataJson: string;
      createdAt: number;
    }>();
    const hasMore = result.results.length > query.limit;
    const rows = hasMore
      ? result.results.slice(0, query.limit)
      : result.results;
    const items = rows.map(row => ({
      id: row.id,
      type: row.type,
      inboxId: row.inboxId,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      data: JSON.parse(row.dataJson) as Record<string, unknown>,
      createdAt: row.createdAt,
    }));
    const last = items.at(-1);
    return c.json({
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    });
  });
  return router;
};
