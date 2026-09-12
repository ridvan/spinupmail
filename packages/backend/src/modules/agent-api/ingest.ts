export type AgentInboundContext = {
  organizationId: string;
  inboxId: string;
  threadId: string;
  eventId: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  subject: string | null;
  receivedAt: number;
};

const normalizeMessageReference = (value: string) => value.trim().slice(0, 998);

export const parseRfcReferences = (value: string | null | undefined) => {
  if (!value) return [];
  const bracketed = value.match(/<[^>]{1,996}>/g);
  const values = bracketed ?? value.split(/\s+/);
  return Array.from(
    new Set(values.map(normalizeMessageReference).filter(Boolean))
  ).slice(-50);
};

export const prepareAgentInboundContext = async (args: {
  db: D1Database;
  organizationId: string;
  inboxId: string;
  emailId: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  subject: string | null;
  receivedAt: number;
}): Promise<AgentInboundContext | null> => {
  const inbox = await args.db
    .prepare(
      `SELECT id FROM agent_inboxes
      WHERE organization_id = ? AND id = ? AND deleted_at IS NULL`
    )
    .bind(args.organizationId, args.inboxId)
    .first();
  if (!inbox) return null;

  const candidates = Array.from(
    new Set(
      [args.inReplyTo, ...args.references]
        .filter((value): value is string => Boolean(value))
        .map(normalizeMessageReference)
    )
  ).slice(-50);
  let threadId: string | null = null;
  if (candidates.length > 0) {
    const placeholders = candidates.map(() => "?").join(",");
    const previous = await args.db
      .prepare(
        `SELECT thread_id FROM emails
        WHERE organization_id = ? AND address_id = ?
          AND message_id IN (${placeholders}) AND thread_id IS NOT NULL
        ORDER BY received_at DESC, id DESC LIMIT 1`
      )
      .bind(args.organizationId, args.inboxId, ...candidates)
      .first<{ thread_id: string }>();
    threadId = previous?.thread_id ?? null;
  }

  return {
    organizationId: args.organizationId,
    inboxId: args.inboxId,
    threadId: threadId ?? crypto.randomUUID(),
    eventId: crypto.randomUUID(),
    messageId: args.messageId,
    inReplyTo: args.inReplyTo,
    references: args.references,
    subject: args.subject,
    receivedAt: args.receivedAt,
  };
};

export const buildAgentInboundStatements = (
  db: D1Database,
  emailId: string,
  context: AgentInboundContext
) => [
  db
    .prepare(
      `INSERT OR IGNORE INTO agent_threads
      (id, organization_id, inbox_id, subject, message_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)`
    )
    .bind(
      context.threadId,
      context.organizationId,
      context.inboxId,
      context.subject,
      context.receivedAt,
      context.receivedAt
    ),
  db
    .prepare(
      `UPDATE agent_threads SET
        message_count = (
          SELECT count(*) FROM emails
          WHERE organization_id = ? AND thread_id = ?
        ),
        updated_at = (
          SELECT max(received_at) FROM emails
          WHERE organization_id = ? AND thread_id = ?
        )
      WHERE organization_id = ? AND id = ?
        AND EXISTS (SELECT 1 FROM emails WHERE id = ? AND address_id = ?)`
    )
    .bind(
      context.organizationId,
      context.threadId,
      context.organizationId,
      context.threadId,
      context.organizationId,
      context.threadId,
      emailId,
      context.inboxId
    ),
  db
    .prepare(
      `INSERT OR IGNORE INTO agent_events
      (id, organization_id, inbox_id, type, resource_type, resource_id, data_json, created_at)
      SELECT ?, ?, ?, 'message.received', 'message', ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM emails WHERE id = ? AND address_id = ?)`
    )
    .bind(
      context.eventId,
      context.organizationId,
      context.inboxId,
      emailId,
      JSON.stringify({ threadId: context.threadId }),
      context.receivedAt,
      emailId,
      context.inboxId
    ),
  db
    .prepare(
      `INSERT OR IGNORE INTO agent_event_outbox
      (event_id, organization_id, state, attempts, available_at)
      SELECT id, organization_id, 'pending', 0, ? FROM agent_events
      WHERE organization_id = ? AND type = 'message.received'
        AND resource_type = 'message' AND resource_id = ?`
    )
    .bind(context.receivedAt, context.organizationId, emailId),
];
