import { publishPendingAgentEvents } from "./events";
import {
  buildAgentInboundStatements,
  parseRfcReferences,
  prepareAgentInboundContext,
} from "./ingest";

export const recoverAgentInboxEvents = async (
  env: CloudflareBindings,
  limit = 100
) => {
  const rows = await env.SUM_DB.prepare(
    `SELECT e.id, e.organization_id, e.address_id, e.message_id,
    e.in_reply_to, e.references_json, e.subject, e.received_at
    FROM emails e JOIN agent_inboxes i
      ON i.organization_id = e.organization_id AND i.id = e.address_id
    WHERE i.deleted_at IS NULL AND NOT EXISTS (
      SELECT 1 FROM agent_events v
      WHERE v.organization_id = e.organization_id
        AND v.type = 'message.received'
        AND v.resource_type = 'message' AND v.resource_id = e.id
    ) ORDER BY e.received_at, e.id LIMIT ?`
  )
    .bind(limit)
    .all<{
      id: string;
      organization_id: string;
      address_id: string;
      message_id: string | null;
      in_reply_to: string | null;
      references_json: string | null;
      subject: string | null;
      received_at: number;
    }>();

  let recovered = 0;
  for (const row of rows.results) {
    const references = row.references_json
      ? (JSON.parse(row.references_json) as string[])
      : parseRfcReferences(null);
    const context = await prepareAgentInboundContext({
      db: env.SUM_DB,
      organizationId: row.organization_id,
      inboxId: row.address_id,
      emailId: row.id,
      messageId: row.message_id,
      inReplyTo: row.in_reply_to,
      references,
      subject: row.subject,
      receivedAt: row.received_at,
    });
    if (!context) continue;
    await env.SUM_DB.batch([
      env.SUM_DB.prepare(
        `UPDATE emails SET thread_id = ?, organization_id = ?, in_reply_to = ?,
        references_json = ?, direction = 'inbound', delivery_state = 'received'
        WHERE id = ? AND address_id = ?`
      ).bind(
        context.threadId,
        context.organizationId,
        context.inReplyTo,
        JSON.stringify(context.references),
        row.id,
        row.address_id
      ),
      ...buildAgentInboundStatements(env.SUM_DB, row.id, context),
    ]);
    recovered += 1;
  }
  const publication = await publishPendingAgentEvents(env, limit);
  return { recovered, ...publication };
};
