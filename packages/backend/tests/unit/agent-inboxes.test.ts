import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppHonoEnv } from "@/app/types";
import { createAgentApiRouter } from "@/modules/agent-api/router";
import { createAgentTestDb } from "../fixtures/agent-db";

let fixture: ReturnType<typeof createAgentTestDb>;
let app: Hono<AppHonoEnv>;
let agent: Awaited<ReturnType<typeof fixture.seedAgent>>;

const request = (url: string, init: RequestInit = {}) =>
  app.request(`/api/v1${url}`, init, {
    SUM_DB: fixture.db,
    EMAIL_DOMAINS: "example.com",
  } as CloudflareBindings);

beforeEach(async () => {
  fixture = createAgentTestDb();
  fixture.seedOrganization();
  fixture.seedOrganization("org-b", "user-b");
  agent = await fixture.seedAgent({ address: "first@example.com" });
  app = new Hono<AppHonoEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", {
      api: {
        getSession: async () => ({
          user: { id: "user-a" },
          session: { id: "session-a", activeOrganizationId: "org-a" },
        }),
      },
    } as never);
    await next();
  });
  app.route("/api/v1", createAgentApiRouter());
});

afterEach(() => fixture.close());

describe("agent inboxes", () => {
  it("creates one persistent inbox for concurrent idempotent retries", async () => {
    const id = crypto.randomUUID();
    const create = () =>
      request("/inboxes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${agent.token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "create-second-inbox",
        },
        body: JSON.stringify({
          id,
          localPart: "second",
          domain: "example.com",
        }),
      });
    const first = await create();
    const replay = await create();
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
    expect(
      fixture.sqlite.prepare("SELECT count(*) AS n FROM agent_inboxes").get()?.n
    ).toBe(2);
  });

  it("lists only credential grants and preserves a deleted address tombstone", async () => {
    const other = await fixture.seedAgent({
      organizationId: "org-b",
      userId: "user-b",
      address: "other@example.com",
    });
    const listed = await request("/inboxes", {
      headers: { Authorization: `Bearer ${agent.token}` },
    });
    const body = (await listed.json()) as { items: Array<{ id: string }> };
    expect(body.items.map(item => item.id)).toEqual([agent.inboxId]);
    expect(body.items.some(item => item.id === other.inboxId)).toBe(false);

    expect(
      (
        await request(`/inboxes/${agent.inboxId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${agent.token}` },
        })
      ).status
    ).toBe(204);
    expect(
      fixture.sqlite
        .prepare("SELECT address FROM agent_address_tombstones")
        .get()?.address
    ).toBe("first@example.com");
    expect(
      fixture.sqlite
        .prepare("SELECT address FROM email_addresses WHERE id = ?")
        .get(agent.inboxId)?.address
    ).toBe("first@example.com");

    const recreate = await request("/inboxes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${agent.token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": "recreate-deleted-address",
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        localPart: "first",
        domain: "example.com",
      }),
    });
    expect(recreate.status).toBe(409);
  });

  it("creates the requested inbox during controlled enrollment", async () => {
    const enrollmentId = crypto.randomUUID();
    const credentialId = crypto.randomUUID();
    const enrollmentSecret = "q".repeat(43);
    const credentialSecret = "r".repeat(43);
    const created = await request("/enrollments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "inbox-enrollment-create",
      },
      body: JSON.stringify({
        enrollmentId,
        enrollmentSecret,
        name: "Inbox enrollment",
        capabilities: ["inboxes:read", "messages:read"],
      }),
    });
    expect(created.status).toBe(201);
    const enrolled = await request("/agent/enroll", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "inbox-enrollment-exchange",
      },
      body: JSON.stringify({
        enrollmentToken: `smenr_v1_${enrollmentId}.${enrollmentSecret}`,
        credentialId,
        credentialSecret,
        agentName: "Inbox agent",
        requestedInbox: { localPart: "onboarded", domain: "example.com" },
      }),
    });
    expect(enrolled.status).toBe(201);
    const body = (await enrolled.json()) as {
      inbox: { address: string };
      credential: { inboxIds: string[] };
    };
    expect(body.inbox.address).toBe("onboarded@example.com");
    expect(body.credential.inboxIds).toEqual([expect.any(String)]);
  });
});
