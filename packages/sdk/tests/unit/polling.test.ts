import {
  SpinupMail,
  SpinupMailTimeoutError,
  SpinupMailValidationError,
} from "@/index";

const listResponse = (items: Array<{ id: string; subject: string }>) =>
  new Response(
    JSON.stringify({
      address: "inbox@spinupmail.dev",
      addressId: "addr-1",
      items: items.map(item => ({
        id: item.id,
        addressId: "addr-1",
        to: "inbox@spinupmail.dev",
        from: "bot@example.com",
        sender: "Bot <bot@example.com>",
        senderLabel: "Bot",
        subject: item.subject,
        messageId: `${item.id}@example.com`,
        rawSize: 10,
        rawTruncated: false,
        isSample: false,
        hasHtml: true,
        hasText: true,
        attachmentCount: 0,
        receivedAt: "2026-04-11T12:00:00.000Z",
        receivedAtMs: 1775908800000,
      })),
      page: 1,
      pageSize: 50,
      totalItems: items.length,
      totalPages: 1,
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }
  );

const detailResponse = (args: {
  id: string;
  subject: string;
  html?: string | null;
  text?: string | null;
}) =>
  new Response(
    JSON.stringify({
      id: args.id,
      addressId: "addr-1",
      address: "inbox@spinupmail.dev",
      to: "inbox@spinupmail.dev",
      from: "bot@example.com",
      sender: "Bot <bot@example.com>",
      senderLabel: "Bot",
      subject: args.subject,
      messageId: `${args.id}@example.com`,
      headers: {},
      html: args.html ?? null,
      text: args.text ?? null,
      raw: null,
      rawSize: 10,
      rawTruncated: false,
      isSample: false,
      rawDownloadPath: "/api/emails/raw",
      attachments: [],
      receivedAt: "2026-04-11T12:00:00.000Z",
      receivedAtMs: 1775908800000,
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }
  );

describe("SpinupMail inbox polling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits until a matching email appears", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(listResponse([]))
      .mockResolvedValueOnce(
        listResponse([
          { id: "email-1", subject: "Ignore me" },
          { id: "email-2", subject: "Verify your login" },
        ])
      )
      .mockResolvedValueOnce(
        detailResponse({
          id: "email-2",
          subject: "Verify your login",
          text: "Verification code: 123456",
        })
      );
    const client = new SpinupMail({
      baseUrl: "https://api.spinupmail.com",
      apiKey: "spin_test",
      organizationId: "org-1",
      fetch: fetchMock,
    });

    const match = await client.inboxes.waitForEmail({
      addressId: "addr-1",
      intervalMs: 1,
      timeoutMs: 50,
      subjectIncludes: "verify your login",
    });

    expect(match.id).toBe("email-2");
    expect(match.text).toContain("123456");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("deduplicates emails already seen in previous poll attempts", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(listResponse([{ id: "email-1", subject: "First" }]))
      );
    const client = new SpinupMail({
      baseUrl: "https://api.spinupmail.com",
      apiKey: "spin_test",
      organizationId: "org-1",
      fetch: fetchMock,
    });

    const resultPromise = client.inboxes.poll({
      addressId: "addr-1",
      intervalMs: 100,
      timeoutMs: 250,
      match: email => email.subject === "Never arrives",
    });

    await vi.advanceTimersByTimeAsync(300);

    const result = await resultPromise;

    expect(result.matchedEmail).toBeNull();
    expect(result.freshItems).toEqual([]);
    expect(result.timedOut).toBe(true);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it("throws SpinupMailTimeoutError when waitForEmail times out", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(listResponse([])));
    const client = new SpinupMail({
      baseUrl: "https://api.spinupmail.com",
      apiKey: "spin_test",
      organizationId: "org-1",
      fetch: fetchMock,
    });

    await expect(
      client.inboxes.waitForEmail({
        addressId: "addr-1",
        intervalMs: 1,
        timeoutMs: 5,
      })
    ).rejects.toBeInstanceOf(SpinupMailTimeoutError);
  });

  it("rejects invalid polling timing options before polling starts", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new SpinupMail({
      baseUrl: "https://api.spinupmail.com",
      apiKey: "spin_test",
      organizationId: "org-1",
      fetch: fetchMock,
    });

    await expect(
      client.inboxes.poll({
        addressId: "addr-1",
        timeoutMs: -1,
      })
    ).rejects.toBeInstanceOf(SpinupMailValidationError);

    await expect(
      client.inboxes.poll({
        addressId: "addr-1",
        timeoutMs: -1,
      })
    ).rejects.toThrow("invalid option: timeoutMs must be a finite number >= 0");

    await expect(
      client.inboxes.waitForEmail({
        addressId: "addr-1",
        intervalMs: 0,
      })
    ).rejects.toBeInstanceOf(SpinupMailValidationError);

    await expect(
      client.inboxes.waitForEmail({
        addressId: "addr-1",
        intervalMs: 0,
      })
    ).rejects.toThrow("invalid option: intervalMs must be a finite number > 0");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filters by body text and deletes the matching email after reading", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        listResponse([
          { id: "email-1", subject: "Your verification email" },
          { id: "email-2", subject: "Your verification email" },
        ])
      )
      .mockResolvedValueOnce(
        detailResponse({
          id: "email-1",
          subject: "Your verification email",
          text: "Ignore this stale message",
        })
      )
      .mockResolvedValueOnce(
        detailResponse({
          id: "email-2",
          subject: "Your verification email",
          text: "Use verification code 654321",
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "email-2", deleted: true }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        })
      );
    const client = new SpinupMail({
      baseUrl: "https://api.spinupmail.com",
      apiKey: "spin_test",
      organizationId: "org-1",
      fetch: fetchMock,
    });

    const email = await client.inboxes.waitForEmail({
      addressId: "addr-1",
      after: new Date("2026-04-11T11:59:00.000Z"),
      subjectIncludes: "verification",
      bodyIncludes: "654321",
      deleteAfterRead: true,
    });

    expect(email.id).toBe("email-2");
    expect(email.text).toContain("654321");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "after=2026-04-11T11%3A59%3A00.000Z"
    );
    expect(String(fetchMock.mock.calls[3]?.[0])).toContain(
      "/api/emails/email-2"
    );
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({
      method: "DELETE",
    });
  });
});
