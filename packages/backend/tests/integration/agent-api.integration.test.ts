import { createApp } from "@/index";
import {
  buildAgentInboundStatements,
  prepareAgentInboundContext,
} from "@/modules/agent-api/ingest";
import { createAgentTestDb } from "../fixtures/agent-db";

const executionCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

const enrollmentId = "00000000-0000-4000-8000-000000000011";
const credentialId = "00000000-0000-4000-8000-000000000012";
const draftId = "00000000-0000-4000-8000-000000000014";
const submissionId = "00000000-0000-4000-8000-000000000015";
const enrollmentSecret = "e".repeat(43);
const credentialSecret = "c".repeat(43);

describe("agent API integration", () => {
  const fixture = createAgentTestDb();
  fixture.seedOrganization("org-a", "user-a");
  fixture.seedOrganization("org-b", "user-b");
  const queue = { send: vi.fn().mockResolvedValue(undefined) };
  const auth = {
    api: {
      getSession: vi.fn().mockResolvedValue({
        session: {
          id: "session-a",
          userId: "user-a",
          activeOrganizationId: "org-a",
        },
        user: { id: "user-a", emailVerified: true },
      }),
    },
    handler: vi.fn().mockResolvedValue(new Response("ok")),
  };
  const app = createApp({ createAuthFactory: () => auth as never });
  const bindings = {
    SUM_DB: fixture.db,
    EMAIL_DOMAINS: "example.com",
    AGENT_OUTBOUND_ENABLED: "true",
    AGENT_OUTBOUND_QUEUE: queue,
  } as unknown as CloudflareBindings;

  const request = (path: string, init?: RequestInit) =>
    app.request(path, init, bindings, executionCtx as never);
  const humanJson = (path: string, body: unknown, idempotencyKey: string) =>
    request(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-org-id": "org-a",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
  const agentJson = (
    path: string,
    body: unknown,
    idempotencyKey: string,
    method = "POST"
  ) =>
    request(path, {
      method,
      headers: {
        authorization: `Bearer smai_v1_${credentialId}.${credentialSecret}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });

  afterAll(() => fixture.close());

  it("keeps discovery public and matches the versioned contract", async () => {
    const discovery = await request("/api/v1/discovery");
    const openapi = await request("/api/v1/openapi.json");
    const llms = await request("/api/v1/llms.txt");

    expect(discovery.status).toBe(200);
    expect(await discovery.json()).toMatchObject({ version: "v1" });
    expect(openapi.status).toBe(200);
    expect(await openapi.json()).toMatchObject({ openapi: "3.1.0" });
    expect(await llms.text()).toContain("SpinupMail Agent Inbox API");
  });

  it("enrolls, receives, drafts, approves, sends once, and reads outcomes", async () => {
    const enrollment = await humanJson(
      "/api/v1/enrollments",
      {
        enrollmentId,
        enrollmentSecret,
        name: "Integration agent",
        capabilities: [
          "inboxes:create",
          "inboxes:read",
          "messages:read",
          "drafts:write",
          "messages:send",
          "events:read",
        ],
        inboxLimit: 1,
        credentialExpiresInDays: 30,
      },
      "integration-enrollment"
    );
    expect(enrollment.status).toBe(201);

    const enrolled = await request("/api/v1/agent/enroll", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "integration-agent-enroll",
      },
      body: JSON.stringify({
        enrollmentToken: `smenr_v1_${enrollmentId}.${enrollmentSecret}`,
        credentialId,
        credentialSecret,
        agentName: "Integration agent",
        credentialName: "Integration credential",
        requestedInbox: {
          localPart: "integration-agent",
          domain: "example.com",
        },
      }),
    });
    expect(enrolled.status).toBe(201);
    const enrolledBody = (await enrolled.json()) as { inbox: { id: string } };
    expect(enrolledBody.inbox.id).toBeTruthy();

    const actualInboxId = enrolledBody.inbox.id;
    const messageId = "00000000-0000-4000-8000-000000000016";
    const receivedAt = Date.now();
    const inboundContext = await prepareAgentInboundContext({
      db: fixture.db,
      organizationId: "org-a",
      inboxId: actualInboxId,
      emailId: messageId,
      messageId: "<integration@example.net>",
      inReplyTo: null,
      references: [],
      subject: "Integration request",
      receivedAt,
    });
    expect(inboundContext).not.toBeNull();
    await fixture.db.batch([
      fixture.db
        .prepare(
          `INSERT INTO emails
          (id, organization_id, address_id, message_id, references_json, thread_id,
           direction, delivery_state, "from", "to", subject, body_text, received_at)
          VALUES (?, 'org-a', ?, '<integration@example.net>', '[]', ?,
          'inbound', 'received', 'sender@example.net', 'integration-agent@example.com',
          'Integration request', 'Please reply', ?)`
        )
        .bind(messageId, actualInboxId, inboundContext!.threadId, receivedAt),
      ...buildAgentInboundStatements(fixture.db, messageId, inboundContext!),
    ]);

    const messages = await request(
      `/api/v1/messages?inboxId=${actualInboxId}&search=reply`,
      {
        headers: {
          authorization: `Bearer smai_v1_${credentialId}.${credentialSecret}`,
        },
      }
    );
    expect(messages.status).toBe(200);
    expect((await messages.json()) as object).toMatchObject({
      items: [{ id: messageId }],
    });

    const draft = await agentJson(
      "/api/v1/drafts",
      {
        id: draftId,
        inboxId: actualInboxId,
        threadId: inboundContext!.threadId,
        to: ["sender@example.net"],
        subject: "Re: Integration request",
        bodyText: "Completed",
        inReplyTo: "<integration@example.net>",
        references: ["<integration@example.net>"],
      },
      "integration-draft"
    );
    expect(draft.status).toBe(201);

    const approved = await humanJson(
      `/api/v1/drafts/${draftId}/approve`,
      { version: 1 },
      "integration-approval"
    );
    expect(approved.status).toBe(200);

    fixture.enableAgentSending({
      organizationId: "org-a",
      userId: "user-a",
      domain: "example.com",
      allowedRecipients: ["sender@example.net"],
    });
    const submitted = await agentJson(
      `/api/v1/drafts/${draftId}/send`,
      { submissionId },
      "integration-submission"
    );
    expect(submitted.status).toBe(202);
    const replay = await agentJson(
      `/api/v1/drafts/${draftId}/send`,
      { submissionId },
      "integration-submission"
    );
    expect(replay.status).toBe(200);
    expect(queue.send).toHaveBeenCalledTimes(1);
    expect(
      fixture.sqlite
        .prepare("SELECT count(*) AS value FROM agent_submissions WHERE id = ?")
        .get(submissionId)?.value
    ).toBe(1);

    const events = await request("/api/v1/events?limit=100", {
      headers: {
        authorization: `Bearer smai_v1_${credentialId}.${credentialSecret}`,
      },
    });
    expect((await events.json()) as object).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ type: "message.received" }),
        expect.objectContaining({ type: "submission.queued" }),
      ]),
    });
    const outcomes = await request(
      `/api/v1/submissions?inboxId=${actualInboxId}&limit=100`,
      {
        headers: {
          authorization: `Bearer smai_v1_${credentialId}.${credentialSecret}`,
        },
      }
    );
    expect(await outcomes.json()).toMatchObject({
      items: [
        {
          id: submissionId,
          outcomes: [{ recipient: "sender@example.net", state: "queued" }],
        },
      ],
    });
  });

  it("denies cross-tenant reads and legacy-key privilege escalation", async () => {
    const other = await fixture.seedAgent({
      organizationId: "org-b",
      userId: "user-b",
      address: "other@example.com",
    });
    fixture.sqlite
      .prepare(
        `INSERT INTO emails
        (id, organization_id, address_id, "from", "to", received_at)
        VALUES ('other-message', 'org-b', ?, 'sender@example.net', ?, ?)`
      )
      .run(other.inboxId, other.address, Date.now());
    const crossTenant = await request("/api/v1/messages/other-message", {
      headers: {
        authorization: `Bearer smai_v1_${credentialId}.${credentialSecret}`,
      },
    });
    expect(crossTenant.status).toBe(404);

    const legacyApproval = await request(`/api/v1/drafts/${draftId}/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "legacy-key",
        "x-org-id": "org-a",
        "idempotency-key": "legacy-approval",
      },
      body: JSON.stringify({ version: 1 }),
    });
    expect(legacyApproval.status).toBe(403);
  });
});
