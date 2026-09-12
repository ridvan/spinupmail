# Agent inbox recovery runbook

Use this runbook for interrupted inbound ingestion, missing event publication,
stalled submissions, provider uncertainty, or a D1/R2 restore drill. Keep the
fleet switch and `AGENT_OUTBOUND_ENABLED` off until the scope is understood.

## Contain

1. Disable the platform fleet switch from Agent Mail as a platform operator.
2. Confirm `AGENT_OUTBOUND_ENABLED="false"` on every outbound worker if the
   incident could duplicate or misdirect mail.
3. Preserve D1, queue, and provider evidence. Do not delete outbox,
   idempotency, submission, recipient outcome, or suppression rows.
4. Record request IDs, stable event IDs, submission IDs, recipient hashes, and
   provider IDs. Never copy bearer credentials or message content into tickets.

## Inbound and event recovery

Inbound storage commits the existing message row, RFC thread updates, durable
event, and event-outbox row in D1. The scheduled handler scans agent-inbox
messages missing `message.received`, reconstructs the thread/event transaction,
and publishes pending outbox rows when `AGENT_EVENT_QUEUE` exists. Polling D1 via
`GET /api/v1/events` remains authoritative if the optional queue is unavailable.

After a restore, run the scheduled handler or invoke the same recovery routine
in an isolated environment. Re-running is safe: stable IDs and unique boundaries
deduplicate recovered messages, events, and outbox rows.

## Submission recovery

The outbound queue and scheduled handler reconcile submissions by stable
submission ID. Retry only known pre-provider failures. Treat a provider timeout,
worker interruption during the call, or missing provider acknowledgement as
`uncertain`; retain the quota reservation and do not resubmit. Resolve it only
from provider evidence or an operator decision.

Provider events are idempotent by provider event ID and recipient. Terminal
states take precedence over late or out-of-order lower-precedence events.

## Local D1/R2 restore drill

1. Export or copy D1 and the private R2 objects into an isolated local/preview
   environment. Never point the drill at production queues or email bindings.
2. Apply migrations `0015_agent_identity.sql` through
   `0017_agent_sending.sql` in order.
3. Verify legacy organization, address, message, and attachment IDs still match
   their pre-restore values.
4. Run the focused recovery test. It creates 100 interrupted inbox workflows,
   recovers each once, and proves a second pass creates no duplicate events:

   ```bash
   pnpm -C packages/backend exec vitest run \
     tests/unit/agent-recovery-drill.test.ts \
     tests/unit/agent-messages.test.ts \
     --config vitest.unit.config.ts
   ```

5. Confirm an authorized credential can retrieve restored raw MIME and an R2
   attachment, while another workspace receives `404` and learns no object key.
6. Poll events twice with the returned cursor and confirm no event repeats.
7. Leave outbound disabled and discard the isolated drill environment after
   recording counts and hashes, not message content.

## Exit criteria

- Every restored inbound message is in exactly one RFC thread.
- Every expected event exists once; pending publication can drain safely.
- Submission and per-recipient states agree with available provider evidence.
- No uncertain submission was resent.
- Raw MIME and attachment retrieval remains workspace/inbox scoped.
- Fleet and workspace sending remain disabled until an authorized operator
  completes incident review.
