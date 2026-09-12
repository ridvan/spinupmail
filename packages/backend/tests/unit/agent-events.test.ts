import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppHonoEnv } from "@/app/types";
import { createAgentApiRouter } from "@/modules/agent-api/router";
import { prepareAgentEventStatements } from "@/modules/agent-api/events";
import { createAgentTestDb } from "../fixtures/agent-db";

let fixture: ReturnType<typeof createAgentTestDb>;
let app: Hono<AppHonoEnv>;
let agent: Awaited<ReturnType<typeof fixture.seedAgent>>;

beforeEach(async () => {
  fixture = createAgentTestDb();
  fixture.seedOrganization();
  agent = await fixture.seedAgent({ address: "events@example.com" });
  app = new Hono<AppHonoEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { api: { getSession: async () => null } } as never);
    await next();
  });
  app.route("/api/v1", createAgentApiRouter());
});

afterEach(() => fixture.close());

describe("agent events", () => {
  it("deduplicates stable resources and advances a strict cursor", async () => {
    const event = {
      id: crypto.randomUUID(),
      organizationId: agent.organizationId,
      inboxId: agent.inboxId,
      type: "message.received",
      resourceType: "message",
      resourceId: "message-1",
      createdAt: Date.now(),
    };
    await fixture.db.batch(prepareAgentEventStatements(fixture.db, event));
    await fixture.db.batch(
      prepareAgentEventStatements(fixture.db, {
        ...event,
        id: crypto.randomUUID(),
      })
    );
    expect(
      fixture.sqlite.prepare("SELECT count(*) AS n FROM agent_events").get()?.n
    ).toBe(1);
    expect(
      fixture.sqlite
        .prepare("SELECT count(*) AS n FROM agent_event_outbox")
        .get()?.n
    ).toBe(1);

    const response = await app.request(
      "/api/v1/events?limit=1",
      { headers: { Authorization: `Bearer ${agent.token}` } },
      { SUM_DB: fixture.db } as CloudflareBindings
    );
    const body = (await response.json()) as {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe(event.id);
    expect(body.nextCursor).toBeNull();
  });
});
