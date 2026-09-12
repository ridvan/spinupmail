import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recordAgentProviderEvent } from "@/modules/agent-api/provider-events";
import { createAgentTestDb } from "../fixtures/agent-db";

let fixture: ReturnType<typeof createAgentTestDb>;
let agent: Awaited<ReturnType<typeof fixture.seedAgent>>;
let submissionId: string;
const recipients = ["one@example.net", "two@example.net", "three@example.net"];

beforeEach(async () => {
  fixture = createAgentTestDb();
  fixture.seedOrganization();
  agent = await fixture.seedAgent({ address: "provider@example.com" });
  fixture.enableAgentSending();
  const draftId = crypto.randomUUID();
  submissionId = crypto.randomUUID();
  const now = Date.now();
  fixture.sqlite
    .prepare(
      `INSERT INTO agent_drafts
      (id, organization_id, inbox_id, to_json, subject, body_text, version,
       content_hash, submitted_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Provider test', 'Body', 1, ?, ?, ?, ?)`
    )
    .run(
      draftId,
      agent.organizationId,
      agent.inboxId,
      JSON.stringify(recipients),
      "a".repeat(64),
      now,
      now,
      now
    );
  fixture.sqlite
    .prepare(
      `INSERT INTO agent_submissions
      (id, organization_id, draft_id, credential_id, state, provider_message_id,
       recipient_count, usage_period, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'submitted', 'provider-message', 3, '2026-09', ?, ?)`
    )
    .run(
      submissionId,
      agent.organizationId,
      draftId,
      agent.credentialId,
      now,
      now
    );
  for (const recipient of recipients) {
    fixture.sqlite
      .prepare(
        `INSERT INTO agent_recipient_outcomes
        (organization_id, submission_id, recipient, state, updated_at)
        VALUES (?, ?, ?, 'submitted', ?)`
      )
      .run(agent.organizationId, submissionId, recipient, now);
  }
  fixture.sqlite
    .prepare(
      `INSERT INTO emails
      (id, organization_id, address_id, message_id, direction, delivery_state,
       "from", "to", received_at)
      VALUES (?, ?, ?, 'provider-message', 'outbound', 'submitted', ?, ?, ?)`
    )
    .run(
      crypto.randomUUID(),
      agent.organizationId,
      agent.inboxId,
      agent.address,
      JSON.stringify(recipients),
      now
    );
});

afterEach(() => fixture.close());

describe("agent provider events", () => {
  it("deduplicates events and preserves terminal-state precedence", async () => {
    const complaint = {
      providerEventId: "event-complaint",
      submissionId,
      recipient: recipients[0]!,
      status: "complaint" as const,
      occurredAt: Date.now(),
    };
    expect(await recordAgentProviderEvent(fixture.db, complaint)).toEqual({
      deduplicated: false,
    });
    expect(await recordAgentProviderEvent(fixture.db, complaint)).toEqual({
      deduplicated: true,
    });
    await recordAgentProviderEvent(fixture.db, {
      ...complaint,
      providerEventId: "event-delivered-late",
      status: "delivered",
      occurredAt: complaint.occurredAt + 1,
    });
    expect(
      fixture.sqlite
        .prepare(
          "SELECT state FROM agent_recipient_outcomes WHERE recipient = ?"
        )
        .get(recipients[0]!)?.state
    ).toBe("complained");
    expect(
      fixture.sqlite
        .prepare(
          "SELECT delivery_state FROM emails WHERE direction = 'outbound'"
        )
        .get()?.delivery_state
    ).toBe("complained");
    expect(
      fixture.sqlite
        .prepare("SELECT suspension_reason FROM agent_sending_policies")
        .get()?.suspension_reason
    ).toBe("recipient_complaint");
    expect(
      fixture.sqlite
        .prepare("SELECT count(*) AS n FROM agent_provider_events")
        .get()?.n
    ).toBe(2);
  });

  it("suspends after three distinct hard bounces in 24 hours", async () => {
    for (const [index, recipient] of recipients.entries()) {
      await recordAgentProviderEvent(fixture.db, {
        providerEventId: `bounce-${index}`,
        submissionId,
        recipient,
        status: "hard_bounce",
        occurredAt: Date.now() + index,
      });
    }
    expect(
      fixture.sqlite
        .prepare("SELECT suspension_reason FROM agent_sending_policies")
        .get()?.suspension_reason
    ).toBe("hard_bounce_threshold");
    expect(
      fixture.sqlite
        .prepare("SELECT count(*) AS n FROM agent_suppressions")
        .get()?.n
    ).toBe(3);
  });
});
