import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppHonoEnv } from "@/app/types";
import { createAgentApiRouter } from "@/modules/agent-api/router";
import { processAgentSubmission } from "@/modules/agent-api/sending";
import { createAgentTestDb } from "../fixtures/agent-db";

let fixture: ReturnType<typeof createAgentTestDb>;
let app: Hono<AppHonoEnv>;
let agent: Awaited<ReturnType<typeof fixture.seedAgent>>;
let queued: unknown[];
let queue: Queue<unknown>;

const env = (extra: Partial<CloudflareBindings> = {}) =>
  ({
    SUM_DB: fixture.db,
    AGENT_OUTBOUND_ENABLED: "true",
    AGENT_OUTBOUND_QUEUE: queue,
    ...extra,
  }) as CloudflareBindings;

const request = (url: string, init: RequestInit = {}) =>
  app.request(`/api/v1${url}`, init, env());

const jsonRequest = (
  url: string,
  method: "POST" | "PATCH" | "PUT",
  body: unknown,
  options: { agent?: boolean; key?: string } = {}
) =>
  request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.agent ? { Authorization: `Bearer ${agent.token}` } : {}),
      ...(options.key ? { "Idempotency-Key": options.key } : {}),
    },
    body: JSON.stringify(body),
  });

const createDraft = async (recipient = "outside@example.net") => {
  const id = crypto.randomUUID();
  const response = await jsonRequest(
    "/drafts",
    "POST",
    {
      id,
      inboxId: agent.inboxId,
      to: [recipient],
      subject: "Review request",
      bodyText: "Please review this exact content.",
    },
    { agent: true, key: `draft-${id}` }
  );
  expect(response.status).toBe(201);
  return (await response.json()) as {
    draft: { id: string; version: number; approvedHash: string | null };
  };
};

beforeEach(async () => {
  fixture = createAgentTestDb();
  fixture.seedOrganization();
  agent = await fixture.seedAgent({
    address: "sender@example.com",
    capabilities: [
      "inboxes:read",
      "messages:read",
      "drafts:write",
      "messages:send",
      "events:read",
    ],
  });
  queued = [];
  queue = {
    send: vi.fn(async message => {
      queued.push(message);
    }),
  } as unknown as Queue<unknown>;
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

describe("agent sending", () => {
  it("binds approval to exact content and submits only once", async () => {
    fixture.enableAgentSending();
    const created = await createDraft();
    const submissionId = crypto.randomUUID();
    expect(
      (
        await jsonRequest(
          `/drafts/${created.draft.id}/send`,
          "POST",
          { submissionId },
          { agent: true, key: "unapproved-send" }
        )
      ).status
    ).toBe(403);

    const approved = await jsonRequest(
      `/drafts/${created.draft.id}/approve`,
      "POST",
      { version: 1 },
      { key: "approve-draft-v1" }
    );
    expect(approved.status).toBe(200);

    const edited = await jsonRequest(
      `/drafts/${created.draft.id}`,
      "PATCH",
      {
        version: 1,
        to: ["outside@example.net"],
        subject: "Changed",
        bodyText: "Changed after approval",
      },
      { agent: true }
    );
    expect(edited.status).toBe(200);
    const editedBody = (await edited.json()) as {
      draft: { version: number; approvedHash: string | null };
    };
    expect(editedBody.draft).toMatchObject({ version: 2, approvedHash: null });
    expect(
      (
        await jsonRequest(
          `/drafts/${created.draft.id}/approve`,
          "POST",
          { version: 2 },
          { agent: true, key: "agent-cannot-approve" }
        )
      ).status
    ).toBe(403);
    expect(
      (
        await jsonRequest(
          "/sending-policy",
          "PUT",
          { sendingEnabled: true, recipientRules: [] },
          { agent: true }
        )
      ).status
    ).toBe(403);

    await jsonRequest(
      `/drafts/${created.draft.id}/approve`,
      "POST",
      { version: 2 },
      { key: "approve-draft-v2" }
    );
    const send = () =>
      jsonRequest(
        `/drafts/${created.draft.id}/send`,
        "POST",
        { submissionId },
        { agent: true, key: "send-approved-draft" }
      );
    expect((await send()).status).toBe(202);
    expect((await send()).status).toBe(200);
    expect(queued).toHaveLength(1);
    expect(
      fixture.sqlite
        .prepare("SELECT count(*) AS n FROM agent_submissions")
        .get()?.n
    ).toBe(1);

    const providerSend = vi.fn(async () => ({ messageId: "provider-1" }));
    await processAgentSubmission({
      env: env({ EMAIL: { send: providerSend } as SendEmail }),
      organizationId: agent.organizationId,
      submissionId,
    });
    expect(providerSend).toHaveBeenCalledTimes(1);
    expect(
      fixture.sqlite
        .prepare("SELECT state FROM agent_submissions WHERE id = ?")
        .get(submissionId)?.state
    ).toBe("submitted");
    expect(
      (
        await jsonRequest(
          `/drafts/${created.draft.id}`,
          "PATCH",
          {
            version: 2,
            to: ["outside@example.net"],
            subject: "Too late",
            bodyText: "Submitted",
          },
          { agent: true }
        )
      ).status
    ).toBe(409);
  });

  it("keeps unknown provider outcomes visible and never resends them", async () => {
    fixture.enableAgentSending({ allowedRecipients: ["allowed@example.net"] });
    const created = await createDraft("allowed@example.net");
    const submissionId = crypto.randomUUID();
    expect(
      (
        await jsonRequest(
          `/drafts/${created.draft.id}/send`,
          "POST",
          { submissionId },
          { agent: true, key: "uncertain-send" }
        )
      ).status
    ).toBe(202);
    const providerSend = vi.fn(async () => {
      throw new Error("provider timeout");
    });
    const process = () =>
      processAgentSubmission({
        env: env({ EMAIL: { send: providerSend } as SendEmail }),
        organizationId: agent.organizationId,
        submissionId,
      });
    await process();
    await process();
    expect(providerSend).toHaveBeenCalledTimes(1);
    expect(
      fixture.sqlite
        .prepare("SELECT state FROM agent_submissions WHERE id = ?")
        .get(submissionId)?.state
    ).toBe("uncertain");
    expect(
      fixture.sqlite
        .prepare("SELECT reserved_recipients FROM agent_usage")
        .get()?.reserved_recipients
    ).toBe(1);
  });

  it("fails closed while the environment fleet switch is off", async () => {
    fixture.enableAgentSending({ allowedRecipients: ["allowed@example.net"] });
    const created = await createDraft("allowed@example.net");
    const response = await app.request(
      `/api/v1/drafts/${created.draft.id}/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${agent.token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "disabled-send",
        },
        body: JSON.stringify({ submissionId: crypto.randomUUID() }),
      },
      env({ AGENT_OUTBOUND_ENABLED: "false" })
    );
    expect(response.status).toBe(503);
    expect(
      fixture.sqlite.prepare("SELECT count(*) AS n FROM agent_usage").get()?.n
    ).toBe(0);
  });
});
