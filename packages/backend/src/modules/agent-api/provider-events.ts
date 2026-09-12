import { agentProviderEventRequestSchema } from "@spinupmail/contracts";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { AgentError, digestSecret, jsonInput } from "./core";
import { prepareAgentEventStatements } from "./events";

const outcomeState = (status: string) =>
  ({
    delivered: "delivered",
    deferred: "deferred",
    hard_bounce: "bounced",
    complaint: "complained",
  })[status] ?? "submitted";

const outcomeRank = (state: string) =>
  ({
    queued: 0,
    submitted: 1,
    deferred: 2,
    delivered: 3,
    bounced: 4,
    complained: 5,
  })[state] ?? 0;

export const recordAgentProviderEvent = async (
  db: D1Database,
  input: {
    providerEventId: string;
    submissionId: string;
    recipient: string;
    status: "delivered" | "deferred" | "hard_bounce" | "complaint";
    occurredAt: number;
  }
) => {
  const submission = await db
    .prepare(
      `SELECT s.organization_id, s.provider_message_id, d.inbox_id
      FROM agent_submissions s JOIN agent_drafts d
        ON d.organization_id = s.organization_id AND d.id = s.draft_id
      WHERE s.id = ?`
    )
    .bind(input.submissionId)
    .first<{
      organization_id: string;
      provider_message_id: string | null;
      inbox_id: string;
    }>();
  if (!submission) {
    throw new AgentError("not_found", "Submission not found", 404);
  }
  const inserted = await db
    .prepare(
      `INSERT OR IGNORE INTO agent_provider_events
      (organization_id, provider_event_id, submission_id, recipient, status,
       occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      submission.organization_id,
      input.providerEventId,
      input.submissionId,
      input.recipient,
      input.status,
      input.occurredAt,
      Date.now()
    )
    .run();
  if ((inserted.meta.changes ?? 0) === 0) return { deduplicated: true };

  const current = await db
    .prepare(
      `SELECT state FROM agent_recipient_outcomes
      WHERE organization_id = ? AND submission_id = ? AND recipient = ?`
    )
    .bind(submission.organization_id, input.submissionId, input.recipient)
    .first<{ state: string }>();
  const nextState = outcomeState(input.status);
  const statements: D1PreparedStatement[] = [];
  const acceptsTransition =
    !current || outcomeRank(nextState) >= outcomeRank(current.state);
  if (acceptsTransition) {
    statements.push(
      db
        .prepare(
          `UPDATE agent_recipient_outcomes SET state = ?, provider_event_id = ?,
          occurred_at = ?, updated_at = ?
          WHERE organization_id = ? AND submission_id = ? AND recipient = ?`
        )
        .bind(
          nextState,
          input.providerEventId,
          input.occurredAt,
          Date.now(),
          submission.organization_id,
          input.submissionId,
          input.recipient
        )
    );
    if (submission.provider_message_id) {
      statements.push(
        db
          .prepare(
            `UPDATE emails SET delivery_state = ?
            WHERE organization_id = ? AND message_id = ? AND direction = 'outbound'`
          )
          .bind(
            nextState,
            submission.organization_id,
            submission.provider_message_id
          )
      );
    }
  }
  if (input.status === "hard_bounce" || input.status === "complaint") {
    statements.push(
      db
        .prepare(
          `INSERT INTO agent_suppressions
          (id, organization_id, recipient, reason, created_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (organization_id, recipient) DO UPDATE SET
            reason = CASE
              WHEN excluded.reason = 'complaint' THEN 'complaint'
              ELSE agent_suppressions.reason
            END`
        )
        .bind(
          crypto.randomUUID(),
          submission.organization_id,
          input.recipient,
          input.status,
          Date.now()
        )
    );
  }
  statements.push(
    ...prepareAgentEventStatements(db, {
      id: crypto.randomUUID(),
      organizationId: submission.organization_id,
      inboxId: submission.inbox_id,
      type: "delivery.updated",
      resourceType: "provider_event",
      resourceId: input.providerEventId,
      data: {
        submissionId: input.submissionId,
        recipient: input.recipient,
        status: input.status,
      },
      createdAt: input.occurredAt,
    })
  );
  await db.batch(statements);

  const hardBounces = await db
    .prepare(
      `SELECT count(DISTINCT recipient) AS value FROM agent_provider_events
      WHERE organization_id = ? AND status = 'hard_bounce' AND occurred_at >= ?`
    )
    .bind(submission.organization_id, Date.now() - 24 * 60 * 60 * 1000)
    .first<{ value: number }>();
  if (input.status === "complaint" || Number(hardBounces?.value ?? 0) >= 3) {
    const reason =
      input.status === "complaint"
        ? "recipient_complaint"
        : "hard_bounce_threshold";
    await db
      .prepare(
        `INSERT INTO agent_sending_policies
        (organization_id, sending_enabled, suspended_at, suspension_reason, updated_at)
        VALUES (?, 0, ?, ?, ?)
        ON CONFLICT (organization_id) DO UPDATE SET
          sending_enabled = 0, suspended_at = excluded.suspended_at,
          suspension_reason = excluded.suspension_reason,
          updated_at = excluded.updated_at`
      )
      .bind(submission.organization_id, Date.now(), reason, Date.now())
      .run();
  }
  return { deduplicated: false };
};

export const createAgentProviderEventsRouter = () => {
  const router = new Hono<AppHonoEnv>();
  router.post("/provider/events", async c => {
    const configured = c.env.AGENT_PROVIDER_EVENT_SECRET?.trim();
    const received = c.req.header("X-Agent-Provider-Secret")?.trim();
    if (
      !configured ||
      !received ||
      (await digestSecret(configured)) !== (await digestSecret(received))
    ) {
      throw new AgentError(
        "unauthorized",
        "Invalid provider event secret",
        401
      );
    }
    const input = await jsonInput(c, agentProviderEventRequestSchema);
    const result = await recordAgentProviderEvent(c.env.SUM_DB, input);
    return c.json(result, result.deduplicated ? 200 : 202);
  });
  return router;
};
