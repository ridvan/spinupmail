import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppHonoEnv } from "@/app/types";
import { createAgentApiRouter } from "@/modules/agent-api/router";
import { createAgentTestDb } from "../fixtures/agent-db";

let fixture: ReturnType<typeof createAgentTestDb>;
let app: Hono<AppHonoEnv>;
let activeUserId = "user-a";
let activeOrganizationId = "org-a";

const enrollmentId = "018f2f86-4f10-7cc8-8f17-3a332f2146d1";
const credentialId = "018f2f86-5145-7ee1-a38c-dbd032a5b15d";
const enrollmentSecret = "a".repeat(43);
const credentialSecret = "b".repeat(43);
const enrollmentToken = `smenr_v1_${enrollmentId}.${enrollmentSecret}`;

const request = (url: string, init: RequestInit = {}) =>
  app.request(`/api/v1${url}`, init, {
    SUM_DB: fixture.db,
  } as CloudflareBindings);

const post = (
  url: string,
  body: unknown,
  key: string,
  headers: Record<string, string> = {}
) =>
  request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      ...headers,
    },
    body: JSON.stringify(body),
  });

const enrollmentInput = {
  enrollmentId,
  enrollmentSecret,
  name: "Build agent enrollment",
  capabilities: ["inboxes:create", "messages:read"] as const,
  inboxLimit: 1,
  credentialExpiresInDays: 30,
};

const enrollInput = {
  enrollmentToken,
  credentialId,
  credentialSecret,
  agentName: "Build agent",
  credentialName: "Local runner",
};

beforeEach(() => {
  fixture = createAgentTestDb();
  fixture.seedOrganization();
  fixture.seedOrganization("org-b", "user-b");
  activeUserId = "user-a";
  activeOrganizationId = "org-a";
  app = new Hono<AppHonoEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", {
      api: {
        getSession: async () => ({
          user: { id: activeUserId },
          session: {
            id: `session-${activeUserId}`,
            activeOrganizationId,
          },
        }),
      },
    } as never);
    await next();
  });
  app.route("/api/v1", createAgentApiRouter());
});

afterEach(() => fixture.close());

describe("agent enrollment", () => {
  it("stores enrollment and credential secrets only as hashes", async () => {
    const created = await post(
      "/enrollments",
      enrollmentInput,
      "create-enrollment-1"
    );
    expect(created.status).toBe(201);
    expect(await created.text()).not.toContain(enrollmentSecret);
    expect(
      fixture.sqlite.prepare("SELECT token_hash FROM agent_enrollments").get()
        ?.token_hash
    ).not.toBe(enrollmentSecret);

    const enrolled = await post("/agent/enroll", enrollInput, "enroll-agent-1");
    expect(enrolled.status).toBe(201);
    const body = await enrolled.text();
    expect(body).not.toContain(credentialSecret);
    expect(body).not.toContain(enrollmentSecret);
    expect(
      fixture.sqlite.prepare("SELECT secret_hash FROM agent_credentials").get()
        ?.secret_hash
    ).not.toBe(credentialSecret);
  });

  it("replays the same request and conflicts on changed input", async () => {
    const first = await post(
      "/enrollments",
      enrollmentInput,
      "create-enrollment-2"
    );
    const replay = await post(
      "/enrollments",
      enrollmentInput,
      "create-enrollment-2"
    );
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
    expect(
      (
        await post(
          "/enrollments",
          { ...enrollmentInput, name: "Changed" },
          "create-enrollment-2"
        )
      ).status
    ).toBe(409);
    expect(
      fixture.sqlite
        .prepare("SELECT count(*) AS n FROM agent_enrollments")
        .get()?.n
    ).toBe(1);
  });

  it("consumes once while allowing an idempotent enrollment retry", async () => {
    await post("/enrollments", enrollmentInput, "create-enrollment-3");
    const first = await post("/agent/enroll", enrollInput, "enroll-agent-3");
    const replay = await post("/agent/enroll", enrollInput, "enroll-agent-3");
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
    expect(
      (
        await post(
          "/agent/enroll",
          { ...enrollInput, credentialId: crypto.randomUUID() },
          "another-enrollment-attempt"
        )
      ).status
    ).toBe(410);
    expect(
      fixture.sqlite.prepare("SELECT count(*) AS n FROM agent_principals").get()
        ?.n
    ).toBe(1);
  });

  it("requires owner or admin membership with two-factor authentication", async () => {
    fixture.sqlite
      .prepare("UPDATE users SET two_factor_enabled = 0 WHERE id = 'user-a'")
      .run();
    expect(
      (await post("/enrollments", enrollmentInput, "create-enrollment-4"))
        .status
    ).toBe(403);

    fixture.sqlite
      .prepare("UPDATE users SET two_factor_enabled = 1 WHERE id = 'user-a'")
      .run();
    expect(
      (
        await post(
          "/enrollments",
          enrollmentInput,
          "create-enrollment-legacy",
          { "X-API-Key": "spin_legacy" }
        )
      ).status
    ).toBe(403);
  });
});
