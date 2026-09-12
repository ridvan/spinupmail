import {
  agentListMessagesQuerySchema,
  agentListThreadsQuerySchema,
} from "@spinupmail/contracts";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import {
  AgentError,
  decodeCursor,
  encodeCursor,
  requireCapability,
} from "./core";
import { requireAccessibleInbox } from "./inboxes";
import { sanitizeEmailHtmlForAgent } from "@/shared/utils/email-html";

type MessageRow = {
  id: string;
  inboxId: string;
  threadId: string | null;
  direction: "inbound" | "outbound";
  messageId: string | null;
  inReplyTo: string | null;
  referencesJson: string | null;
  fromValue: string;
  toValue: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  deliveryState: string;
  receivedAt: number;
};

const messageDto = async (row: MessageRow) => ({
  id: row.id,
  inboxId: row.inboxId,
  threadId: row.threadId,
  direction: row.direction,
  messageId: row.messageId,
  inReplyTo: row.inReplyTo,
  references: row.referencesJson
    ? (JSON.parse(row.referencesJson) as string[])
    : [],
  from: row.fromValue,
  to: row.toValue,
  subject: row.subject,
  bodyText: row.bodyText,
  bodyHtml: row.bodyHtml ? await sanitizeEmailHtmlForAgent(row.bodyHtml) : null,
  deliveryState: row.deliveryState,
  receivedAt: row.receivedAt,
});

const escapeLike = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");

export const createAgentMessagesRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.get("/messages", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "messages:read");
    const query = agentListMessagesQuerySchema.parse(c.req.query());
    await requireAccessibleInbox(c.env.SUM_DB, actor, query.inboxId);
    const cursor = decodeCursor(query.cursor);
    const search = query.search
      ? `%${escapeLike(query.search.toLowerCase())}%`
      : null;
    const result = await c.env.SUM_DB.prepare(
      `SELECT id, address_id AS inboxId, thread_id AS threadId, direction,
      message_id AS messageId, in_reply_to AS inReplyTo,
      references_json AS referencesJson, "from" AS fromValue, "to" AS toValue,
      subject, body_text AS bodyText, body_html AS bodyHtml,
      delivery_state AS deliveryState, received_at AS receivedAt
      FROM emails WHERE organization_id = ? AND address_id = ?
      ${
        search
          ? `AND (lower(coalesce(subject, '')) LIKE ? ESCAPE '\\'
        OR lower("from") LIKE ? ESCAPE '\\'
        OR lower(coalesce(body_text, '')) LIKE ? ESCAPE '\\')`
          : ""
      }
      ${cursor ? "AND (received_at < ? OR (received_at = ? AND id < ?))" : ""}
      ORDER BY received_at DESC, id DESC LIMIT ?`
    )
      .bind(
        actor.organizationId,
        query.inboxId,
        ...(search ? [search, search, search] : []),
        ...(cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : []),
        query.limit + 1
      )
      .all<MessageRow>();
    const hasMore = result.results.length > query.limit;
    const rows = hasMore
      ? result.results.slice(0, query.limit)
      : result.results;
    const items = await Promise.all(rows.map(messageDto));
    const last = items.at(-1);
    return c.json({
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.receivedAt, last.id) : null,
    });
  });

  router.get("/messages/:id", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "messages:read");
    const row = await c.env.SUM_DB.prepare(
      `SELECT id, address_id AS inboxId, thread_id AS threadId, direction,
      message_id AS messageId, in_reply_to AS inReplyTo,
      references_json AS referencesJson, "from" AS fromValue, "to" AS toValue,
      subject, body_text AS bodyText, body_html AS bodyHtml,
      delivery_state AS deliveryState, received_at AS receivedAt
      FROM emails WHERE organization_id = ? AND id = ?`
    )
      .bind(actor.organizationId, c.req.param("id"))
      .first<MessageRow>();
    if (!row) throw new AgentError("not_found", "Message not found", 404);
    await requireAccessibleInbox(c.env.SUM_DB, actor, row.inboxId);
    return c.json({ message: await messageDto(row) });
  });

  router.get("/threads", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "messages:read");
    const query = agentListThreadsQuerySchema.parse(c.req.query());
    await requireAccessibleInbox(c.env.SUM_DB, actor, query.inboxId);
    const cursor = decodeCursor(query.cursor);
    const result = await c.env.SUM_DB.prepare(
      `SELECT id, inbox_id AS inboxId, subject, message_count AS messageCount,
      created_at AS createdAt, updated_at AS updatedAt
      FROM agent_threads WHERE organization_id = ? AND inbox_id = ?
      ${cursor ? "AND (updated_at < ? OR (updated_at = ? AND id < ?))" : ""}
      ORDER BY updated_at DESC, id DESC LIMIT ?`
    )
      .bind(
        actor.organizationId,
        query.inboxId,
        ...(cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : []),
        query.limit + 1
      )
      .all<{
        id: string;
        inboxId: string;
        subject: string | null;
        messageCount: number;
        createdAt: number;
        updatedAt: number;
      }>();
    const hasMore = result.results.length > query.limit;
    const items = hasMore
      ? result.results.slice(0, query.limit)
      : result.results;
    const last = items.at(-1);
    return c.json({
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.updatedAt, last.id) : null,
    });
  });

  router.get("/threads/:id", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "messages:read");
    const thread = await c.env.SUM_DB.prepare(
      `SELECT id, inbox_id AS inboxId, subject, message_count AS messageCount,
      created_at AS createdAt, updated_at AS updatedAt
      FROM agent_threads WHERE organization_id = ? AND id = ?`
    )
      .bind(actor.organizationId, c.req.param("id"))
      .first<{
        id: string;
        inboxId: string;
        subject: string | null;
        messageCount: number;
        createdAt: number;
        updatedAt: number;
      }>();
    if (!thread) throw new AgentError("not_found", "Thread not found", 404);
    await requireAccessibleInbox(c.env.SUM_DB, actor, thread.inboxId);
    const messages = await c.env.SUM_DB.prepare(
      `SELECT id, address_id AS inboxId, thread_id AS threadId, direction,
      message_id AS messageId, in_reply_to AS inReplyTo,
      references_json AS referencesJson, "from" AS fromValue, "to" AS toValue,
      subject, body_text AS bodyText, body_html AS bodyHtml,
      delivery_state AS deliveryState, received_at AS receivedAt
      FROM emails WHERE organization_id = ? AND thread_id = ?
      ORDER BY received_at, id LIMIT 100`
    )
      .bind(actor.organizationId, thread.id)
      .all<MessageRow>();
    return c.json({
      thread,
      messages: await Promise.all(messages.results.map(messageDto)),
    });
  });

  return router;
};
