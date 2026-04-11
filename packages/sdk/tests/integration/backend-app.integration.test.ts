import { SpinupMail } from "@/index";

const addressServiceMocks = vi.hoisted(() => ({
  listEmailAddresses: vi.fn(),
  listRecentAddressActivity: vi.fn(),
  getEmailAddress: vi.fn(),
  createEmailAddress: vi.fn(),
  updateEmailAddress: vi.fn(),
  deleteEmailAddress: vi.fn(),
}));

const emailServiceMocks = vi.hoisted(() => ({
  listEmails: vi.fn(),
  getEmailDetail: vi.fn(),
  deleteEmail: vi.fn(),
  getEmailRaw: vi.fn(),
  getEmailAttachment: vi.fn(),
}));

const organizationServiceMocks = vi.hoisted(() => ({
  getEmailActivityStats: vi.fn(),
  getEmailSummaryStats: vi.fn(),
  createOrganization: vi.fn(),
  getOrganizationStats: vi.fn(),
}));

vi.mock("@/modules/email-addresses/service", () => addressServiceMocks);
vi.mock("@/modules/emails/service", () => emailServiceMocks);
vi.mock("@/modules/organizations/service", () => organizationServiceMocks);

type SessionShape = {
  session?: {
    id: string;
    userId?: string;
    activeOrganizationId?: string | null;
  };
  user?: {
    id: string;
    emailVerified?: boolean | null;
  };
} | null;

const createAuthFactory = (options: {
  session: SessionShape;
  organization?: { id?: string | null } | null;
}) => {
  const organization =
    "organization" in options ? options.organization : { id: "org-1" };

  return () =>
    ({
      api: {
        getSession: vi.fn().mockResolvedValue(options.session),
        getFullOrganization: vi.fn().mockResolvedValue(organization),
      },
      handler: vi.fn().mockResolvedValue(new Response("ok")),
    }) as never;
};

const bindings = {
  EMAIL_DOMAINS: "spinupmail.dev",
  MAX_ADDRESSES_PER_ORGANIZATION: "10",
  MAX_RECEIVED_EMAILS_PER_ORGANIZATION: "1000",
  MAX_RECEIVED_EMAILS_PER_ADDRESS: "100",
} as unknown as CloudflareBindings;

const executionCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

describe("SpinupMail SDK backend app integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("talks to backend Hono routes with API-key headers and parses responses", async () => {
    const { createApp } = await import("../../../backend/src/index");
    const app = createApp({
      createAuthFactory: createAuthFactory({
        session: {
          session: {
            id: "session-1",
            userId: "user-1",
            activeOrganizationId: "org-1",
          },
          user: {
            id: "user-1",
            emailVerified: true,
          },
        },
      }),
    });

    addressServiceMocks.listEmailAddresses.mockResolvedValue({
      items: [
        {
          id: "addr-1",
          address: "sdk@spinupmail.dev",
          localPart: "sdk",
          domain: "spinupmail.dev",
          meta: {},
          emailCount: 0,
          allowedFromDomains: [],
          blockedSenderDomains: [],
          inboundRatePolicy: null,
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
          createdAt: "2026-04-11T10:00:00.000Z",
          createdAtMs: 1775901600000,
          expiresAt: null,
          expiresAtMs: null,
          lastReceivedAt: null,
          lastReceivedAtMs: null,
        },
      ],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      addressLimit: 10,
      totalPages: 1,
      sortBy: "createdAt",
      sortDirection: "desc",
    });

    emailServiceMocks.getEmailRaw.mockResolvedValue(
      new Response("raw-from-backend", {
        status: 200,
        headers: {
          "content-type": "message/rfc822",
          "content-disposition": 'attachment; filename="mail-1.eml"',
        },
      })
    );

    organizationServiceMocks.getEmailSummaryStats.mockResolvedValue({
      totalEmailCount: 1,
      attachmentCount: 0,
      attachmentSizeTotal: 0,
      attachmentSizeLimit: 0,
      topDomains: [],
      busiestInboxes: [],
      dormantInboxes: [],
    });

    const appFetch: typeof fetch = async (input, init) => {
      const url =
        typeof input === "string" || input instanceof URL
          ? new URL(String(input))
          : new URL(input.url);

      return app.request(
        `${url.pathname}${url.search}`,
        init,
        bindings,
        executionCtx as never
      );
    };

    const client = new SpinupMail({
      baseUrl: "https://api.spinupmail.com",
      apiKey: "spin_test",
      organizationId: "org-1",
      fetch: appFetch,
    });

    const domains = await client.domains.get();
    const addresses = await client.addresses.list();
    const summary = await client.stats.getEmailSummary();
    const raw = await client.emails.getRaw("mail-1");

    expect(domains.default).toBe("spinupmail.dev");
    expect(addresses.items[0]?.id).toBe("addr-1");
    expect(summary.totalEmailCount).toBe(1);
    await expect(raw.text()).resolves.toBe("raw-from-backend");

    expect(addressServiceMocks.listEmailAddresses).toHaveBeenCalledWith({
      env: bindings,
      organizationId: "org-1",
      queryPayload: {},
    });

    const rawCall = emailServiceMocks.getEmailRaw.mock.calls[0]?.[0] as {
      env: CloudflareBindings;
      organizationId: string;
      emailId: string;
    };
    expect(rawCall.organizationId).toBe("org-1");
    expect(rawCall.emailId).toBe("mail-1");
  }, 15_000);

  it("polls through backend routes until a message arrives", async () => {
    const { createApp } = await import("../../../backend/src/index");
    const app = createApp({
      createAuthFactory: createAuthFactory({
        session: {
          session: {
            id: "session-1",
            userId: "user-1",
            activeOrganizationId: "org-1",
          },
          user: {
            id: "user-1",
            emailVerified: true,
          },
        },
      }),
    });

    emailServiceMocks.listEmails
      .mockResolvedValueOnce({
        status: 200,
        body: {
          address: "sdk@spinupmail.dev",
          addressId: "addr-1",
          items: [],
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        body: {
          address: "sdk@spinupmail.dev",
          addressId: "addr-1",
          items: [
            {
              id: "mail-2",
              addressId: "addr-1",
              to: "sdk@spinupmail.dev",
              from: "bot@example.com",
              sender: "Bot <bot@example.com>",
              senderLabel: "Bot",
              subject: "Ready",
              messageId: "mail-2@example.com",
              rawSize: 22,
              rawTruncated: false,
              isSample: false,
              hasHtml: true,
              hasText: true,
              attachmentCount: 0,
              receivedAt: "2026-04-11T10:01:00.000Z",
              receivedAtMs: 1775901660000,
            },
          ],
        },
      });
    emailServiceMocks.getEmailDetail.mockResolvedValue({
      status: 200,
      body: {
        id: "mail-2",
        addressId: "addr-1",
        address: "sdk@spinupmail.dev",
        to: "sdk@spinupmail.dev",
        from: "bot@example.com",
        sender: "Bot <bot@example.com>",
        senderLabel: "Bot",
        subject: "Ready",
        messageId: "mail-2@example.com",
        headers: {},
        html: "<p>Ready</p>",
        text: "Ready",
        raw: null,
        rawSize: 22,
        rawTruncated: false,
        isSample: false,
        rawDownloadPath: "/api/emails/mail-2/raw",
        attachments: [],
        receivedAt: "2026-04-11T10:01:00.000Z",
        receivedAtMs: 1775901660000,
      },
    });

    const appFetch: typeof fetch = async (input, init) => {
      const url =
        typeof input === "string" || input instanceof URL
          ? new URL(String(input))
          : new URL(input.url);

      return app.request(
        `${url.pathname}${url.search}`,
        init,
        bindings,
        executionCtx as never
      );
    };

    const client = new SpinupMail({
      baseUrl: "https://api.spinupmail.com",
      apiKey: "spin_test",
      organizationId: "org-1",
      fetch: appFetch,
    });

    const email = await client.inboxes.waitForEmail({
      addressId: "addr-1",
      intervalMs: 1,
      timeoutMs: 50,
      match: item => item.subject === "Ready",
    });

    expect(email.id).toBe("mail-2");
    expect(email.text).toBe("Ready");
    expect(emailServiceMocks.listEmails).toHaveBeenCalledTimes(2);
    expect(emailServiceMocks.getEmailDetail).toHaveBeenCalledTimes(1);
  });
});
