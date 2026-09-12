import {
  agentDraftListQuerySchema,
  agentSubmitDraftRequestSchema,
} from "@spinupmail/contracts";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import {
  AgentError,
  auditStatement,
  decodeCursor,
  encodeCursor,
  jsonInput,
  requestIdFor,
  requireCapability,
} from "./core";
import { draftDto, findDraft, type AgentDraftRow } from "./drafts";
import { prepareAgentEventStatements } from "./events";
import {
  abandonIdempotency,
  claimIdempotency,
  completeIdempotencyStatement,
  requireIdempotencyKey,
} from "./idempotency";
import { requireAccessibleInbox } from "./inboxes";
import { assertSendingGates } from "./sending-policy";

export type AgentOutboundQueueMessage = {
  kind: "agent-submission";
  organizationId: string;
  submissionId: string;
};

export const isAgentOutboundQueueBatch = (
  batch: MessageBatch
): batch is MessageBatch<AgentOutboundQueueMessage> =>
  batch.messages.length > 0 &&
  batch.messages.every(message => {
    const body = message.body;
    return (
      typeof body === "object" &&
      body !== null &&
      "kind" in body &&
      body.kind === "agent-submission"
    );
  });

const usagePeriod = (now: number) => new Date(now).toISOString().slice(0, 7);

const recipientsForDraft = (draft: AgentDraftRow) =>
  Array.from(
    new Set([
      ...(JSON.parse(draft.to_json) as string[]),
      ...(JSON.parse(draft.cc_json) as string[]),
      ...(JSON.parse(draft.bcc_json) as string[]),
    ])
  );

const reserveUsage = async (args: {
  db: D1Database;
  organizationId: string;
  period: string;
  recipients: number;
  limit: number;
}) => {
  await args.db
    .prepare(
      `INSERT OR IGNORE INTO agent_usage
      (organization_id, period, reserved_recipients, submitted_recipients, updated_at)
      VALUES (?, ?, 0, 0, ?)`
    )
    .bind(args.organizationId, args.period, Date.now())
    .run();
  const result = await args.db
    .prepare(
      `UPDATE agent_usage SET reserved_recipients = reserved_recipients + ?,
      updated_at = ? WHERE organization_id = ? AND period = ?
      AND reserved_recipients + submitted_recipients + ? <= ?`
    )
    .bind(
      args.recipients,
      Date.now(),
      args.organizationId,
      args.period,
      args.recipients,
      args.limit
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
};

const releaseUsage = async (args: {
  db: D1Database;
  organizationId: string;
  period: string;
  recipients: number;
}) => {
  await args.db
    .prepare(
      `UPDATE agent_usage SET
      reserved_recipients = max(0, reserved_recipients - ?), updated_at = ?
      WHERE organization_id = ? AND period = ?`
    )
    .bind(args.recipients, Date.now(), args.organizationId, args.period)
    .run();
};

type SubmissionRow = AgentDraftRow & {
  submission_id: string;
  submission_state:
    "queued" | "submitting" | "submitted" | "uncertain" | "failed";
  credential_id: string;
  recipient_count: number;
  usage_period: string;
  inbox_address: string;
  credential_expires_at: number;
  credential_revoked_at: number | null;
  principal_revoked_at: number | null;
};

const findSubmission = (db: D1Database, organizationId: string, id: string) =>
  db
    .prepare(
      `SELECT s.id AS submission_id, s.state AS submission_state,
      s.credential_id, s.recipient_count, s.usage_period,
      d.id, d.organization_id, d.inbox_id, d.thread_id,
      d.created_by_principal_id, d.to_json, d.cc_json, d.bcc_json, d.subject,
      d.body_text, d.body_html, d.in_reply_to, d.references_json, d.version,
      d.content_hash, d.approved_hash, d.approved_by_user_id, d.approved_at,
      d.submitted_at, d.created_at, d.updated_at, a.address AS inbox_address,
      c.expires_at AS credential_expires_at, c.revoked_at AS credential_revoked_at,
      p.revoked_at AS principal_revoked_at
      FROM agent_submissions s
      JOIN agent_drafts d ON d.organization_id = s.organization_id AND d.id = s.draft_id
      JOIN email_addresses a ON a.organization_id = d.organization_id AND a.id = d.inbox_id
      JOIN agent_credentials c ON c.organization_id = s.organization_id AND c.id = s.credential_id
      JOIN agent_principals p ON p.organization_id = c.organization_id AND p.id = c.principal_id
      WHERE s.organization_id = ? AND s.id = ?`
    )
    .bind(organizationId, id)
    .first<SubmissionRow>();

const markKnownFailure = async (
  db: D1Database,
  row: SubmissionRow,
  code: string
) => {
  const result = await db
    .prepare(
      `UPDATE agent_submissions SET state = 'failed', failure_code = ?, updated_at = ?
      WHERE organization_id = ? AND id = ? AND state = 'queued'`
    )
    .bind(code, Date.now(), row.organization_id, row.submission_id)
    .run();
  if ((result.meta.changes ?? 0) > 0) {
    await releaseUsage({
      db,
      organizationId: row.organization_id,
      period: row.usage_period,
      recipients: row.recipient_count,
    });
  }
};

const markUncertain = async (
  db: D1Database,
  row: SubmissionRow,
  reason: string
) => {
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `UPDATE agent_submissions SET state = 'uncertain', failure_code = ?, updated_at = ?
        WHERE organization_id = ? AND id = ? AND state = 'submitting'`
      )
      .bind(reason.slice(0, 100), now, row.organization_id, row.submission_id),
    db
      .prepare(
        `UPDATE agent_recipient_outcomes SET state = 'uncertain', updated_at = ?
        WHERE organization_id = ? AND submission_id = ?`
      )
      .bind(now, row.organization_id, row.submission_id),
    ...prepareAgentEventStatements(db, {
      id: crypto.randomUUID(),
      organizationId: row.organization_id,
      inboxId: row.inbox_id,
      type: "submission.uncertain",
      resourceType: "submission",
      resourceId: row.submission_id,
      createdAt: now,
    }),
  ]);
};

export const processAgentSubmission = async (args: {
  env: CloudflareBindings;
  organizationId: string;
  submissionId: string;
}) => {
  const row = await findSubmission(
    args.env.SUM_DB,
    args.organizationId,
    args.submissionId
  );
  if (!row || row.submission_state !== "queued") return;
  const recipients = recipientsForDraft(row);
  try {
    if (
      row.credential_revoked_at !== null ||
      row.principal_revoked_at !== null ||
      row.credential_expires_at <= Date.now()
    ) {
      throw new AgentError(
        "credential_invalid",
        "Credential is no longer active",
        403
      );
    }
    await assertSendingGates({
      db: args.env.SUM_DB,
      env: args.env,
      organizationId: row.organization_id,
      sendingDomain: row.inbox_address.slice(
        row.inbox_address.lastIndexOf("@") + 1
      ),
      recipients,
      contentHash: row.content_hash,
      approvedHash: row.approved_hash,
    });
    if (!args.env.EMAIL) {
      throw new AgentError(
        "provider_unavailable",
        "Email provider is unavailable",
        503
      );
    }
  } catch (error) {
    await markKnownFailure(
      args.env.SUM_DB,
      row,
      error instanceof AgentError ? error.code : "preflight_failed"
    );
    return;
  }

  const claimed = await args.env.SUM_DB.prepare(
    `UPDATE agent_submissions SET state = 'submitting', updated_at = ?
    WHERE organization_id = ? AND id = ? AND state = 'queued'`
  )
    .bind(Date.now(), row.organization_id, row.submission_id)
    .run();
  if ((claimed.meta.changes ?? 0) === 0) return;

  try {
    const result = await args.env.EMAIL.send({
      from: row.inbox_address,
      to: JSON.parse(row.to_json) as string[],
      cc: JSON.parse(row.cc_json) as string[],
      bcc: JSON.parse(row.bcc_json) as string[],
      subject: row.subject,
      text: row.body_text ?? undefined,
      html: row.body_html ?? undefined,
      headers: {
        ...(row.in_reply_to ? { "In-Reply-To": row.in_reply_to } : {}),
        ...((JSON.parse(row.references_json) as string[]).length > 0
          ? {
              References: (JSON.parse(row.references_json) as string[]).join(
                " "
              ),
            }
          : {}),
      },
    });
    const now = Date.now();
    const messageId = crypto.randomUUID();
    await args.env.SUM_DB.batch([
      args.env.SUM_DB.prepare(
        `UPDATE agent_submissions SET state = 'submitted', provider_message_id = ?,
        failure_code = NULL, updated_at = ?
        WHERE organization_id = ? AND id = ? AND state = 'submitting'`
      ).bind(result.messageId, now, row.organization_id, row.submission_id),
      args.env.SUM_DB.prepare(
        `UPDATE agent_recipient_outcomes SET state = 'submitted', updated_at = ?
        WHERE organization_id = ? AND submission_id = ?`
      ).bind(now, row.organization_id, row.submission_id),
      args.env.SUM_DB.prepare(
        `UPDATE agent_usage SET
        reserved_recipients = max(0, reserved_recipients - ?),
        submitted_recipients = submitted_recipients + ?, updated_at = ?
        WHERE organization_id = ? AND period = ?`
      ).bind(
        row.recipient_count,
        row.recipient_count,
        now,
        row.organization_id,
        row.usage_period
      ),
      args.env.SUM_DB.prepare(
        `INSERT INTO emails
        (id, organization_id, address_id, message_id, in_reply_to, references_json,
         thread_id, direction, delivery_state, "from", "to", subject, body_text,
         body_html, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'outbound', 'submitted', ?, ?, ?, ?, ?, ?)`
      ).bind(
        messageId,
        row.organization_id,
        row.inbox_id,
        result.messageId,
        row.in_reply_to,
        row.references_json,
        row.thread_id,
        row.inbox_address,
        row.to_json,
        row.subject,
        row.body_text,
        row.body_html,
        now
      ),
      ...prepareAgentEventStatements(args.env.SUM_DB, {
        id: crypto.randomUUID(),
        organizationId: row.organization_id,
        inboxId: row.inbox_id,
        type: "submission.submitted",
        resourceType: "submission",
        resourceId: row.submission_id,
        data: { providerMessageId: result.messageId },
        createdAt: now,
      }),
    ]);
  } catch (error) {
    await markUncertain(
      args.env.SUM_DB,
      row,
      error instanceof Error ? error.message : "provider_outcome_unknown"
    );
  }
};

export const handleAgentOutboundQueueBatch = async (args: {
  batch: MessageBatch<AgentOutboundQueueMessage>;
  env: CloudflareBindings;
}) => {
  for (const message of args.batch.messages) {
    try {
      await processAgentSubmission({
        env: args.env,
        organizationId: message.body.organizationId,
        submissionId: message.body.submissionId,
      });
      message.ack();
    } catch {
      message.retry();
    }
  }
};

export const recoverAgentSubmissions = async (
  env: CloudflareBindings,
  now = Date.now()
) => {
  await env.SUM_DB.prepare(
    `UPDATE agent_submissions SET state = 'uncertain',
    failure_code = 'interrupted_provider_call', updated_at = ?
    WHERE state = 'submitting' AND updated_at < ?`
  )
    .bind(now, now - 5 * 60_000)
    .run();
  if (!env.AGENT_OUTBOUND_QUEUE) return;
  const queued = await env.SUM_DB.prepare(
    `SELECT id, organization_id FROM agent_submissions
    WHERE state = 'queued' ORDER BY updated_at, id LIMIT 100`
  ).all<{ id: string; organization_id: string }>();
  for (const row of queued.results) {
    await env.AGENT_OUTBOUND_QUEUE.send({
      kind: "agent-submission",
      organizationId: row.organization_id,
      submissionId: row.id,
    });
  }
};

export const createAgentSendingRouter = () => {
  const router = new Hono<AppHonoEnv>();
  router.get("/submissions", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "messages:send");
    const query = agentDraftListQuerySchema.parse(c.req.query());
    await requireAccessibleInbox(c.env.SUM_DB, actor, query.inboxId);
    const cursor = decodeCursor(query.cursor);
    const submissions = await c.env.SUM_DB.prepare(
      `SELECT s.id, s.draft_id AS draftId, s.state,
      s.provider_message_id AS providerMessageId,
      s.recipient_count AS recipientCount, s.failure_code AS failureCode,
      s.created_at AS createdAt, s.updated_at AS updatedAt
      FROM agent_submissions s JOIN agent_drafts d
        ON d.organization_id = s.organization_id AND d.id = s.draft_id
      WHERE s.organization_id = ? AND d.inbox_id = ?
      ${cursor ? "AND (s.updated_at < ? OR (s.updated_at = ? AND s.id < ?))" : ""}
      ORDER BY s.updated_at DESC, s.id DESC LIMIT ?`
    )
      .bind(
        actor.organizationId,
        query.inboxId,
        ...(cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : []),
        query.limit + 1
      )
      .all<{
        id: string;
        draftId: string;
        state: string;
        providerMessageId: string | null;
        recipientCount: number;
        failureCode: string | null;
        createdAt: number;
        updatedAt: number;
      }>();
    const hasMore = submissions.results.length > query.limit;
    const selected = hasMore
      ? submissions.results.slice(0, query.limit)
      : submissions.results;
    const items = await Promise.all(
      selected.map(async submission => {
        const outcomes = await c.env.SUM_DB.prepare(
          `SELECT recipient, state, provider_event_id AS providerEventId,
          occurred_at AS occurredAt, updated_at AS updatedAt
          FROM agent_recipient_outcomes
          WHERE organization_id = ? AND submission_id = ? ORDER BY recipient`
        )
          .bind(actor.organizationId, submission.id)
          .all();
        return { ...submission, outcomes: outcomes.results };
      })
    );
    const last = items.at(-1);
    return c.json({
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.updatedAt, last.id) : null,
    });
  });

  router.post("/drafts/:id/send", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "messages:send");
    if (actor.kind !== "agent" || !actor.credentialId) {
      throw new AgentError(
        "agent_credential_required",
        "Agent credential required",
        403
      );
    }
    if (!c.env.AGENT_OUTBOUND_QUEUE) {
      throw new AgentError(
        "outbound_queue_unavailable",
        "Outbound queue is unavailable",
        503
      );
    }
    const input = await jsonInput(c, agentSubmitDraftRequestSchema);
    const key = requireIdempotencyKey(c);
    const draft = await findDraft(
      c.env.SUM_DB,
      actor.organizationId,
      c.req.param("id")
    );
    if (!draft) throw new AgentError("not_found", "Draft not found", 404);
    await requireAccessibleInbox(c.env.SUM_DB, actor, draft.inbox_id);
    const claim = await claimIdempotency<{
      submission: unknown;
      draft: unknown;
    }>({
      db: c.env.SUM_DB,
      organizationId: actor.organizationId,
      actorId: actor.credentialId,
      operation: "drafts.send",
      key,
      input: {
        draftId: draft.id,
        submissionId: input.submissionId,
        hash: draft.content_hash,
      },
    });
    if (claim.kind === "replay") return c.json(claim.response, 200);
    if (draft.submitted_at !== null) {
      await abandonIdempotency(c.env.SUM_DB, claim.id);
      throw new AgentError(
        "draft_immutable",
        "Draft was already submitted",
        409
      );
    }
    const recipients = recipientsForDraft(draft);
    const inbox = await c.env.SUM_DB.prepare(
      "SELECT address, domain FROM email_addresses WHERE organization_id = ? AND id = ?"
    )
      .bind(actor.organizationId, draft.inbox_id)
      .first<{ address: string; domain: string }>();
    if (!inbox) {
      await abandonIdempotency(c.env.SUM_DB, claim.id);
      throw new AgentError("not_found", "Inbox not found", 404);
    }
    let period = "";
    try {
      const gates = await assertSendingGates({
        db: c.env.SUM_DB,
        env: c.env,
        organizationId: actor.organizationId,
        sendingDomain: inbox.domain,
        recipients,
        contentHash: draft.content_hash,
        approvedHash: draft.approved_hash,
      });
      const now = Date.now();
      period = usagePeriod(now);
      const reserved = await reserveUsage({
        db: c.env.SUM_DB,
        organizationId: actor.organizationId,
        period,
        recipients: recipients.length,
        limit: gates.monthlyRecipientLimit,
      });
      if (!reserved) {
        throw new AgentError(
          "quota_exceeded",
          "Monthly recipient quota exceeded",
          429
        );
      }
      const response = {
        submission: {
          id: input.submissionId,
          draftId: draft.id,
          state: "queued",
          recipientCount: recipients.length,
          createdAt: now,
        },
        draft: { ...draftDto(draft), submittedAt: now },
      };
      await c.env.SUM_DB.batch([
        c.env.SUM_DB.prepare(
          `INSERT INTO agent_submissions
          (id, organization_id, draft_id, credential_id, state, recipient_count,
           usage_period, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)`
        ).bind(
          input.submissionId,
          actor.organizationId,
          draft.id,
          actor.credentialId,
          recipients.length,
          period,
          now,
          now
        ),
        ...recipients.map(recipient =>
          c.env.SUM_DB.prepare(
            `INSERT INTO agent_recipient_outcomes
            (organization_id, submission_id, recipient, state, updated_at)
            VALUES (?, ?, ?, 'queued', ?)`
          ).bind(actor.organizationId, input.submissionId, recipient, now)
        ),
        c.env.SUM_DB.prepare(
          `UPDATE agent_drafts SET submitted_at = ?, updated_at = ?
          WHERE organization_id = ? AND id = ? AND submitted_at IS NULL`
        ).bind(now, now, actor.organizationId, draft.id),
        ...prepareAgentEventStatements(c.env.SUM_DB, {
          id: crypto.randomUUID(),
          organizationId: actor.organizationId,
          inboxId: draft.inbox_id,
          type: "submission.queued",
          resourceType: "submission",
          resourceId: input.submissionId,
          createdAt: now,
        }),
        auditStatement(
          c.env.SUM_DB,
          actor,
          requestIdFor(c),
          "submission.queued",
          "submission",
          input.submissionId,
          { recipientCount: recipients.length }
        ),
        completeIdempotencyStatement(
          c.env.SUM_DB,
          claim.id,
          "submission",
          input.submissionId,
          response
        ),
      ]);
      try {
        await c.env.AGENT_OUTBOUND_QUEUE.send({
          kind: "agent-submission",
          organizationId: actor.organizationId,
          submissionId: input.submissionId,
        });
      } catch {
        // Scheduled recovery republishes this stable submission ID.
      }
      return c.json(response, 202);
    } catch (error) {
      if (period) {
        await releaseUsage({
          db: c.env.SUM_DB,
          organizationId: actor.organizationId,
          period,
          recipients: recipients.length,
        });
      }
      await abandonIdempotency(c.env.SUM_DB, claim.id);
      throw error;
    }
  });
  return router;
};
