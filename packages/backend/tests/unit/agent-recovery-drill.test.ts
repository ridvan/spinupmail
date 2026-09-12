import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recoverAgentInboxEvents } from "@/modules/agent-api/recovery";
import { createAgentTestDb } from "../fixtures/agent-db";

let fixture: ReturnType<typeof createAgentTestDb>;
let agent: Awaited<ReturnType<typeof fixture.seedAgent>>;

beforeEach(async () => {
  fixture = createAgentTestDb();
  fixture.seedOrganization();
  agent = await fixture.seedAgent({ address: "recovery@example.com" });
});

afterEach(() => fixture.close());

describe("agent event recovery", () => {
  it("recovers and deduplicates 100 interrupted inbox workflows", async () => {
    const now = Date.now();
    for (let index = 0; index < 100; index += 1) {
      fixture.sqlite
        .prepare(
          `INSERT INTO emails
          (id, organization_id, address_id, message_id, "from", "to", subject, received_at)
          VALUES (?, ?, ?, ?, 'sender@example.net', ?, 'Recovery', ?)`
        )
        .run(
          `recovery-${index}`,
          agent.organizationId,
          agent.inboxId,
          `<recovery-${index}@example.net>`,
          agent.address,
          now + index
        );
    }
    const env = { SUM_DB: fixture.db } as CloudflareBindings;
    const first = await recoverAgentInboxEvents(env, 100);
    const second = await recoverAgentInboxEvents(env, 100);
    expect(first.recovered).toBe(100);
    expect(second.recovered).toBe(0);
    expect(
      fixture.sqlite.prepare("SELECT count(*) AS n FROM agent_events").get()?.n
    ).toBe(100);
    expect(
      fixture.sqlite
        .prepare("SELECT count(*) AS n FROM agent_event_outbox")
        .get()?.n
    ).toBe(100);
  });
});
