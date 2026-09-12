import {
  SpinupMailAgentClient,
  SpinupMailApiError,
  SpinupMailTimeoutError,
} from "@/index";

const inbox = {
  id: "00000000-0000-4000-8000-000000000001",
  organizationId: "org-1",
  principalId: "00000000-0000-4000-8000-000000000002",
  address: "agent@spinupmail.dev",
  localPart: "agent",
  domain: "spinupmail.dev",
  createdAt: 1,
  deletedAt: null,
};

const json = (value: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

describe("SpinupMailAgentClient", () => {
  it("sends a scoped bearer request and validates the response", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ inbox }, { status: 201 }));
    const client = new SpinupMailAgentClient({
      baseUrl: "https://api.spinupmail.test/",
      credential: "smai_v1_test.secret",
      fetch: fetchMock,
    });

    const result = await client.createInbox(
      {
        id: inbox.id,
        localPart: inbox.localPart,
        domain: inbox.domain,
      },
      { idempotencyKey: "create-inbox-0001" }
    );

    expect(result).toEqual({ inbox });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.spinupmail.test/api/v1/inboxes");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer smai_v1_test.secret");
    expect(headers.get("idempotency-key")).toBe("create-inbox-0001");
  });

  it("generates the credential secret locally during enrollment", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      json(
        {
          agent: {
            id: "00000000-0000-4000-8000-000000000003",
            organizationId: "org-1",
            name: "mailer",
            createdAt: 1,
            revokedAt: null,
          },
          credential: {
            id: "00000000-0000-4000-8000-000000000004",
            organizationId: "org-1",
            principalId: "00000000-0000-4000-8000-000000000003",
            name: "Agent client",
            capabilities: ["messages:read"],
            inboxIds: [],
            createdAt: 1,
            expiresAt: 2,
            revokedAt: null,
          },
          inbox: null,
        },
        { status: 201 }
      )
    );
    const client = new SpinupMailAgentClient({
      baseUrl: "https://api.spinupmail.test",
      fetch: fetchMock,
    });

    const result = await client.enroll(
      {
        enrollmentToken:
          "smenr_v1_00000000-0000-4000-8000-000000000005.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        agentName: "mailer",
      },
      { idempotencyKey: "enroll-agent-0001" }
    );

    expect(result.credentialToken).toMatch(
      /^smai_v1_[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
    expect(body.credentialSecret).toHaveLength(43);
    expect(body.credentialId).toMatch(/^[0-9a-f-]{36}$/);
    expect(fetchMock.mock.calls[0]![1]?.headers).not.toEqual(
      expect.objectContaining({ authorization: expect.anything() })
    );
  });

  it("enforces deadlines", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    );
    const client = new SpinupMailAgentClient({
      baseUrl: "https://api.spinupmail.test",
      credential: "credential",
      fetch: fetchMock,
      timeoutMs: 5,
    });

    await expect(client.listInboxes()).rejects.toBeInstanceOf(
      SpinupMailTimeoutError
    );
  });

  it("strips credentials before following a cross-origin redirect", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://region.spinupmail.test/inboxes" },
        })
      )
      .mockResolvedValueOnce(json({ items: [inbox], nextCursor: null }));
    const client = new SpinupMailAgentClient({
      baseUrl: "https://api.spinupmail.test",
      credential: "credential",
      organizationId: "org-1",
      fetch: fetchMock,
    });

    await client.listInboxes();

    const redirectedHeaders = new Headers(fetchMock.mock.calls[1]![1]?.headers);
    expect(redirectedHeaders.get("authorization")).toBeNull();
    expect(redirectedHeaders.get("x-org-id")).toBeNull();
  });

  it("does not follow cross-origin redirects containing request secrets", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 307,
        headers: { location: "https://other.test/enroll" },
      })
    );
    const client = new SpinupMailAgentClient({
      baseUrl: "https://api.spinupmail.test",
      fetch: fetchMock,
    });

    await expect(
      client.enroll(
        {
          enrollmentToken:
            "smenr_v1_00000000-0000-4000-8000-000000000005.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          agentName: "mailer",
        },
        { idempotencyKey: "enroll-agent-0002" }
      )
    ).rejects.toBeInstanceOf(SpinupMailApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
