import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppHonoEnv } from "@/app/types";
import { authenticateAgentToken } from "@/modules/agent-api/auth";
import {
  actorCan,
  inboxAllowed,
  requireHumanAdmin,
} from "@/modules/agent-api/core";
import { createAgentApiRouter } from "@/modules/agent-api/router";
import { createAgentTestDb } from "../fixtures/agent-db";

let fixture: ReturnType<typeof createAgentTestDb>;
let app: Hono<AppHonoEnv>;
const enrollmentId = "018f2f86-716a-7b03-95f2-91397cedda67";
const credentialId = "018f2f86-73b3-7e91-899c-155b8e7a7f01";
const enrollmentSecret = "c".repeat(43);
const credentialSecret = "d".repeat(43);
const credentialToken = `smai_v1_${credentialId}.${credentialSecret}`;

const request = (url: string, init: RequestInit = {}) =>
  app.request(`/api/v1${url}`, init, {
    SUM_DB: fixture.db,
  } as CloudflareBindings);

const post = (url: string, body: unknown, key: string) =>
  request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  fixture = createAgentTestDb();
  fixture.seedOrganization();
  fixture.seedOrganization("org-b", "user-b");
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
  await post(
    "/enrollments",
    {
      enrollmentId,
      enrollmentSecret,
      name: "Identity test",
      capabilities: ["inboxes:create", "messages:read"],
    },
    "identity-enrollment"
  );
  await post(
    "/agent/enroll",
    {
      enrollmentToken: `smenr_v1_${enrollmentId}.${enrollmentSecret}`,
      credentialId,
      credentialSecret,
      agentName: "Identity agent",
    },
    "identity-enroll"
  );
});

afterEach(() => fixture.close());

describe("agent identity", () => {
  it("authenticates the assembled client-held token with fixed capabilities", async () => {
    const actor = await authenticateAgentToken(fixture.db, credentialToken);
    expect(actor.organizationId).toBe("org-a");
    expect(actorCan(actor, "messages:read")).toBe(true);
    expect(actorCan(actor, "messages:send")).toBe(false);
    expect(() => requireHumanAdmin(actor)).toThrow();
  });

  it("rejects cross-organization headers and never falls back from a bad bearer", async () => {
    expect(
      (
        await request("/capabilities", {
          headers: {
            Authorization: `Bearer ${credentialToken}`,
            "X-Org-Id": "org-b",
          },
        })
      ).status
    ).toBe(403);
    expect(
      (
        await request("/capabilities", {
          headers: { Authorization: "Bearer invalid" },
        })
      ).status
    ).toBe(401);
  });

  it("revokes credentials and principals immediately", async () => {
    expect(
      (await request(`/credentials/${credentialId}`, { method: "DELETE" }))
        .status
    ).toBe(204);
    await expect(
      authenticateAgentToken(fixture.db, credentialToken)
    ).rejects.toMatchObject({ status: 401 });

    fixture.sqlite
      .prepare("UPDATE agent_credentials SET revoked_at = NULL WHERE id = ?")
      .run(credentialId);
    const principalId = String(
      fixture.sqlite.prepare("SELECT principal_id FROM agent_credentials").get()
        ?.principal_id
    );
    expect(
      (await request(`/agents/${principalId}`, { method: "DELETE" })).status
    ).toBe(204);
    await expect(
      authenticateAgentToken(fixture.db, credentialToken)
    ).rejects.toMatchObject({ status: 401 });
  });

  it("keeps inbox grants organization-bound", async () => {
    const actor = await authenticateAgentToken(fixture.db, credentialToken);
    expect(
      inboxAllowed(actor, { id: "missing", organization_id: "org-a" })
    ).toBe(false);
    expect(
      inboxAllowed(actor, { id: "missing", organization_id: "org-b" })
    ).toBe(false);
  });

  it("reserves the fleet switch for platform operators", async () => {
    expect((await request("/operator/fleet")).status).toBe(403);
    fixture.sqlite
      .prepare("UPDATE users SET role = 'admin' WHERE id = 'user-a'")
      .run();
    expect((await request("/operator/fleet")).status).toBe(200);
    const updated = await request("/operator/fleet", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendingEnabled: true }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      control: { sendingEnabled: true, updatedByUserId: "user-a" },
    });
  });

  it("database constraints reject cross-organization credentials", () => {
    const principalId = String(
      fixture.sqlite.prepare("SELECT id FROM agent_principals").get()?.id
    );
    expect(() =>
      fixture.sqlite
        .prepare(
          `INSERT INTO agent_credentials
          (id, organization_id, principal_id, secret_hash, name, created_at, expires_at)
          VALUES (?, 'org-b', ?, 'cross-org', 'bad', 0, 1)`
        )
        .run(crypto.randomUUID(), principalId)
    ).toThrow();
  });
});
