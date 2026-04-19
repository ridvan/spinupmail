import { handleIncomingEmail } from "@/modules/inbound-email/handler";

const mocks = vi.hoisted(() => ({
  findAddressByRecipient: vi.fn(),
  findInboundEmailByAddressAndMessageId: vi.fn(),
  getInboxReservationCounts: vi.fn(),
  reserveInboxSlot: vi.fn(),
  incrementAddressEmailCount: vi.fn(),
  decrementAddressEmailCount: vi.fn(),
  resetAddressEmailCount: vi.fn(),
  deleteEmailsForAddress: vi.fn(),
  insertInboundEmail: vi.fn(),
  updateAddressLastReceivedAt: vi.fn(),
  readRawWithLimit: vi.fn(),
  extractBodiesFromRaw: vi.fn(),
  sanitizeEmailHtml: vi.fn(),
  capTextForStorage: vi.fn(),
  persistRawEmailToR2: vi.fn(),
  persistAttachments: vi.fn(),
  deleteR2ObjectsByPrefix: vi.fn(),
  validateAddressAvailability: vi.fn(),
  shouldAcceptSenderDomain: vi.fn(),
  checkInboundAbusePreflight: vi.fn(),
  recordAcceptedInboundEmailAbuse: vi.fn(),
  getDb: vi.fn(),
  dispatchEmailReceivedEvent: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/modules/inbound-email/repo", () => ({
  findAddressByRecipient: mocks.findAddressByRecipient,
  findInboundEmailByAddressAndMessageId:
    mocks.findInboundEmailByAddressAndMessageId,
  getInboxReservationCounts: mocks.getInboxReservationCounts,
  reserveInboxSlot: mocks.reserveInboxSlot,
  incrementAddressEmailCount: mocks.incrementAddressEmailCount,
  decrementAddressEmailCount: mocks.decrementAddressEmailCount,
  resetAddressEmailCount: mocks.resetAddressEmailCount,
  deleteEmailsForAddress: mocks.deleteEmailsForAddress,
  insertInboundEmail: mocks.insertInboundEmail,
  updateAddressLastReceivedAt: mocks.updateAddressLastReceivedAt,
}));

vi.mock("@/modules/inbound-email/parser", () => ({
  readRawWithLimit: mocks.readRawWithLimit,
  extractBodiesFromRaw: mocks.extractBodiesFromRaw,
  sanitizeEmailHtml: mocks.sanitizeEmailHtml,
  capTextForStorage: mocks.capTextForStorage,
}));

vi.mock("@/modules/inbound-email/storage", () => ({
  persistRawEmailToR2: mocks.persistRawEmailToR2,
  persistAttachments: mocks.persistAttachments,
}));

vi.mock("@/shared/utils/r2", () => ({
  deleteR2ObjectsByPrefix: mocks.deleteR2ObjectsByPrefix,
}));

vi.mock("@/modules/inbound-email/policy", () => ({
  validateAddressAvailability: mocks.validateAddressAvailability,
  shouldAcceptSenderDomain: mocks.shouldAcceptSenderDomain,
}));

vi.mock("@/modules/inbound-email/abuse", () => ({
  checkInboundAbusePreflight: mocks.checkInboundAbusePreflight,
  recordAcceptedInboundEmailAbuse: mocks.recordAcceptedInboundEmailAbuse,
}));

vi.mock("@/modules/integrations/service", () => ({
  dispatchEmailReceivedEvent: mocks.dispatchEmailReceivedEvent,
}));

const buildMessage = () => {
  const headers = new Headers([
    ["from", '"John Smith" <sender@example.com>'],
    ["subject", "Hello"],
    ["message-id", "msg-1"],
  ]);

  return {
    to: "inbox@spinupmail.com",
    from: "sender@example.com",
    headers,
    rawSize: 100,
    raw: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("raw body"));
        controller.close();
      },
    }),
    setReject: vi.fn(),
    forward: vi.fn().mockResolvedValue(undefined),
  };
};

const buildCtx = () => ({
  waitUntil: vi.fn(),
});

describe("inbound email handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockReturnValue({});
    mocks.updateAddressLastReceivedAt.mockResolvedValue(undefined);
    mocks.readRawWithLimit.mockResolvedValue({
      raw: "raw body",
      rawBytes: new TextEncoder().encode("raw body"),
      bytes: 8,
      truncated: false,
    });
    mocks.extractBodiesFromRaw.mockResolvedValue({
      html: "<p>Hello</p>",
      text: "Hello",
      attachments: [],
    });
    mocks.sanitizeEmailHtml.mockResolvedValue("<p>Hello</p>");
    mocks.capTextForStorage.mockImplementation(value => value);
    mocks.persistRawEmailToR2.mockResolvedValue(undefined);
    mocks.persistAttachments.mockResolvedValue(undefined);
    mocks.getInboxReservationCounts.mockResolvedValue({
      addressEmailCount: 0,
      organizationEmailCount: 0,
    });
    mocks.reserveInboxSlot.mockResolvedValue(true);
    mocks.incrementAddressEmailCount.mockResolvedValue(undefined);
    mocks.decrementAddressEmailCount.mockResolvedValue(undefined);
    mocks.resetAddressEmailCount.mockResolvedValue(undefined);
    mocks.deleteEmailsForAddress.mockResolvedValue(undefined);
    mocks.deleteR2ObjectsByPrefix.mockResolvedValue(undefined);
    mocks.findInboundEmailByAddressAndMessageId.mockResolvedValue(null);
    mocks.insertInboundEmail.mockResolvedValue({ inserted: true });
    mocks.shouldAcceptSenderDomain.mockReturnValue({
      allowed: true,
      allowedFromDomains: [],
      senderDomain: "example.com",
    });
    mocks.checkInboundAbusePreflight.mockResolvedValue({
      allowed: true,
      senderAddress: "sender@example.com",
      senderDomain: "example.com",
      context: {
        addressId: "address-1",
      },
    });
    mocks.recordAcceptedInboundEmailAbuse.mockResolvedValue(undefined);
    mocks.dispatchEmailReceivedEvent.mockResolvedValue({ queuedCount: 0 });
    mocks.validateAddressAvailability.mockReturnValue({ allowed: true });
  });

  it("rejects unknown recipients", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue(null);

    await handleIncomingEmail(
      message as never,
      {} as CloudflareBindings,
      ctx as never
    );

    expect(message.setReject).toHaveBeenCalledWith("Address not registered");
    expect(mocks.insertInboundEmail).not.toHaveBeenCalled();
  });

  it("rejects unavailable addresses", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: null,
      expiresAt: null,
    });
    mocks.validateAddressAvailability.mockReturnValue({
      allowed: false,
      reason: "Address expired",
    });

    await handleIncomingEmail(
      message as never,
      {} as CloudflareBindings,
      ctx as never
    );

    expect(message.setReject).toHaveBeenCalledWith("Address expired");
    expect(mocks.insertInboundEmail).not.toHaveBeenCalled();
  });

  it("drops disallowed sender domains without DB writes", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: JSON.stringify({ allowedFromDomains: ["foo.com"] }),
      expiresAt: null,
    });
    mocks.shouldAcceptSenderDomain.mockReturnValue({
      allowed: false,
      senderDomain: "example.com",
      allowedFromDomains: ["foo.com"],
    });

    await handleIncomingEmail(
      message as never,
      {} as CloudflareBindings,
      ctx as never
    );

    expect(message.setReject).not.toHaveBeenCalled();
    expect(mocks.insertInboundEmail).not.toHaveBeenCalled();
    expect(mocks.checkInboundAbusePreflight).not.toHaveBeenCalled();
  });

  it("drops mail rejected by abuse policy before DB writes", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: null,
      expiresAt: null,
    });
    mocks.checkInboundAbusePreflight.mockResolvedValue({
      allowed: false,
      reason: "sender_domain_rate_limit",
      senderAddress: "sender@example.com",
      senderDomain: "example.com",
    });

    await handleIncomingEmail(
      message as never,
      {} as CloudflareBindings,
      ctx as never
    );

    expect(mocks.insertInboundEmail).not.toHaveBeenCalled();
    expect(mocks.readRawWithLimit).not.toHaveBeenCalled();
  });

  it("rejects incoming mail when inbox limit is reached in reject mode", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: JSON.stringify({
        maxReceivedEmailCount: 3,
        maxReceivedEmailAction: "rejectNew",
      }),
      expiresAt: null,
    });
    mocks.getInboxReservationCounts.mockResolvedValue({
      addressEmailCount: 3,
      organizationEmailCount: 3,
    });
    mocks.checkInboundAbusePreflight.mockResolvedValue({
      allowed: true,
      senderAddress: "sender@example.com",
      senderDomain: "example.com",
      context: {
        addressId: "address-1",
      },
    });

    await handleIncomingEmail(
      message as never,
      {} as CloudflareBindings,
      ctx as never
    );

    expect(message.setReject).toHaveBeenCalledWith(
      "Address inbox limit reached"
    );
    expect(mocks.deleteEmailsForAddress).not.toHaveBeenCalled();
    expect(mocks.reserveInboxSlot).not.toHaveBeenCalled();
    expect(mocks.insertInboundEmail).not.toHaveBeenCalled();
  });

  it("rejects incoming mail when the organization inbox hard limit is reached", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: null,
      expiresAt: null,
    });
    mocks.getInboxReservationCounts.mockResolvedValue({
      addressEmailCount: 2,
      organizationEmailCount: 5,
    });

    await handleIncomingEmail(
      message as never,
      {
        MAX_RECEIVED_EMAILS_PER_ORGANIZATION: "5",
      } as CloudflareBindings,
      ctx as never
    );

    expect(message.setReject).toHaveBeenCalledWith(
      "Organization inbox limit reached"
    );
    expect(mocks.deleteEmailsForAddress).not.toHaveBeenCalled();
    expect(mocks.reserveInboxSlot).not.toHaveBeenCalled();
    expect(mocks.insertInboundEmail).not.toHaveBeenCalled();
  });

  it("cleans inbox and accepts new mail when limit is reached in clean mode", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: JSON.stringify({
        maxReceivedEmailCount: 2,
        maxReceivedEmailAction: "cleanAll",
      }),
      expiresAt: null,
    });
    mocks.getInboxReservationCounts
      .mockResolvedValueOnce({
        addressEmailCount: 2,
        organizationEmailCount: 2,
      })
      .mockResolvedValueOnce({
        addressEmailCount: 0,
        organizationEmailCount: 0,
      });
    mocks.reserveInboxSlot.mockResolvedValueOnce(true);

    await handleIncomingEmail(
      message as never,
      {
        R2_BUCKET: {} as R2Bucket,
      } as CloudflareBindings,
      ctx as never
    );

    expect(mocks.deleteR2ObjectsByPrefix).toHaveBeenCalledTimes(2);
    expect(mocks.deleteEmailsForAddress).toHaveBeenCalledWith({}, "address-1");
    expect(mocks.resetAddressEmailCount).toHaveBeenCalledWith({}, "address-1");
    expect(mocks.insertInboundEmail).toHaveBeenCalledTimes(1);
  });

  it("cleans inbox at the default address cap when no explicit inbox meta is stored", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: null,
      expiresAt: null,
    });
    mocks.getInboxReservationCounts
      .mockResolvedValueOnce({
        addressEmailCount: 2,
        organizationEmailCount: 2,
      })
      .mockResolvedValueOnce({
        addressEmailCount: 0,
        organizationEmailCount: 0,
      });
    mocks.reserveInboxSlot.mockResolvedValueOnce(true);

    await handleIncomingEmail(
      message as never,
      {
        MAX_RECEIVED_EMAILS_PER_ADDRESS: "2",
        R2_BUCKET: {} as R2Bucket,
      } as CloudflareBindings,
      ctx as never
    );

    expect(mocks.deleteR2ObjectsByPrefix).toHaveBeenCalledTimes(2);
    expect(mocks.deleteEmailsForAddress).toHaveBeenCalledWith({}, "address-1");
    expect(mocks.resetAddressEmailCount).toHaveBeenCalledWith({}, "address-1");
    expect(mocks.insertInboundEmail).toHaveBeenCalledTimes(1);
  });

  it("rejects when clean mode still cannot reserve a slot", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: JSON.stringify({
        maxReceivedEmailCount: 2,
        maxReceivedEmailAction: "cleanAll",
      }),
      expiresAt: null,
    });
    mocks.checkInboundAbusePreflight.mockResolvedValue({
      allowed: true,
      senderAddress: "sender@example.com",
      senderDomain: "example.com",
      context: {
        addressId: "address-1",
      },
    });
    mocks.getInboxReservationCounts
      .mockResolvedValueOnce({
        addressEmailCount: 2,
        organizationEmailCount: 2,
      })
      .mockResolvedValueOnce({
        addressEmailCount: 2,
        organizationEmailCount: 2,
      });

    await handleIncomingEmail(
      message as never,
      {
        R2_BUCKET: {} as R2Bucket,
      } as CloudflareBindings,
      ctx as never
    );

    expect(message.setReject).toHaveBeenCalledWith(
      "Address inbox limit reached"
    );
    expect(mocks.insertInboundEmail).not.toHaveBeenCalled();
    expect(mocks.reserveInboxSlot).not.toHaveBeenCalled();
  });

  it("does not clean an inbox when only the organization limit is reached", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: JSON.stringify({
        maxReceivedEmailCount: 2,
        maxReceivedEmailAction: "cleanAll",
      }),
      expiresAt: null,
    });
    mocks.getInboxReservationCounts.mockResolvedValue({
      addressEmailCount: 1,
      organizationEmailCount: 5,
    });

    await handleIncomingEmail(
      message as never,
      {
        MAX_RECEIVED_EMAILS_PER_ORGANIZATION: "5",
        R2_BUCKET: {} as R2Bucket,
      } as CloudflareBindings,
      ctx as never
    );

    expect(message.setReject).toHaveBeenCalledWith(
      "Organization inbox limit reached"
    );
    expect(mocks.deleteR2ObjectsByPrefix).not.toHaveBeenCalled();
    expect(mocks.deleteEmailsForAddress).not.toHaveBeenCalled();
    expect(mocks.resetAddressEmailCount).not.toHaveBeenCalled();
  });

  it("short-circuits already-persisted duplicates before abuse checks or quota reservation", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: JSON.stringify({
        maxReceivedEmailCount: 1,
        maxReceivedEmailAction: "rejectNew",
      }),
      expiresAt: null,
    });
    mocks.findInboundEmailByAddressAndMessageId.mockResolvedValue({
      id: "email-1",
    });

    await handleIncomingEmail(
      message as never,
      {} as CloudflareBindings,
      ctx as never
    );

    expect(message.setReject).not.toHaveBeenCalled();
    expect(mocks.checkInboundAbusePreflight).not.toHaveBeenCalled();
    expect(mocks.reserveInboxSlot).not.toHaveBeenCalled();
    expect(mocks.insertInboundEmail).not.toHaveBeenCalled();
    expect(mocks.recordAcceptedInboundEmailAbuse).not.toHaveBeenCalled();
  });

  it("does not clean an inbox for an already-persisted duplicate when cleanAll is configured", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: JSON.stringify({
        maxReceivedEmailCount: 1,
        maxReceivedEmailAction: "cleanAll",
      }),
      expiresAt: null,
    });
    mocks.findInboundEmailByAddressAndMessageId.mockResolvedValue({
      id: "email-1",
    });

    await handleIncomingEmail(
      message as never,
      {
        R2_BUCKET: {} as R2Bucket,
      } as CloudflareBindings,
      ctx as never
    );

    expect(mocks.deleteR2ObjectsByPrefix).not.toHaveBeenCalled();
    expect(mocks.deleteEmailsForAddress).not.toHaveBeenCalled();
    expect(mocks.resetAddressEmailCount).not.toHaveBeenCalled();
    expect(mocks.reserveInboxSlot).not.toHaveBeenCalled();
  });

  it("persists accepted email and schedules post-processing", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: null,
      expiresAt: null,
    });

    await handleIncomingEmail(
      message as never,
      {
        EMAIL_FORWARD_TO: "dest@example.com",
      } as CloudflareBindings,
      ctx as never
    );

    expect(mocks.insertInboundEmail).toHaveBeenCalledTimes(1);
    expect(mocks.insertInboundEmail).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        sender: "John Smith <sender@example.com>",
        from: "sender@example.com",
      })
    );
    expect(mocks.recordAcceptedInboundEmailAbuse).toHaveBeenCalledWith({
      context: {
        addressId: "address-1",
      },
    });
    expect(mocks.persistRawEmailToR2).toHaveBeenCalledTimes(1);
    expect(mocks.persistAttachments).toHaveBeenCalledTimes(1);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(4);
    expect(message.forward).toHaveBeenCalledWith("dest@example.com");
  });

  it("dispatches the generic email.received event after a successful insert", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: null,
      expiresAt: null,
    });

    await handleIncomingEmail(
      message as never,
      {} as CloudflareBindings,
      ctx as never
    );

    expect(mocks.dispatchEmailReceivedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        addressId: "address-1",
        emailId: expect.any(String),
        attachmentCount: 0,
      })
    );
    expect(ctx.waitUntil).toHaveBeenCalledTimes(3);
  });

  it("normalizes bigint rawSize values before insert", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    message.rawSize = 100n as never;
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: null,
      expiresAt: null,
    });

    await handleIncomingEmail(
      message as never,
      {} as CloudflareBindings,
      ctx as never
    );

    expect(mocks.insertInboundEmail).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        rawSize: 100,
      })
    );
  });

  it("rejects unrepresentable bigint rawSize values before parsing", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    message.rawSize = (BigInt(Number.MAX_SAFE_INTEGER) + 1n) as never;
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: null,
      expiresAt: null,
    });

    await handleIncomingEmail(
      message as never,
      {} as CloudflareBindings,
      ctx as never
    );

    expect(message.setReject).toHaveBeenCalledWith(
      "Temporary processing error"
    );
    expect(mocks.readRawWithLimit).not.toHaveBeenCalled();
    expect(mocks.insertInboundEmail).not.toHaveBeenCalled();
  });

  it("ignores parsed attachments when attachments are disabled", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: null,
      expiresAt: null,
    });

    await handleIncomingEmail(
      message as never,
      {
        EMAIL_ATTACHMENTS_ENABLED: "false",
      } as CloudflareBindings,
      ctx as never
    );

    expect(mocks.extractBodiesFromRaw).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      {
        includeAttachments: false,
      }
    );
    expect(mocks.persistAttachments).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [],
      })
    );
  });

  it("rolls back a reserved inbox slot when insert loses a duplicate race", async () => {
    const message = buildMessage();
    const ctx = buildCtx();
    mocks.findAddressByRecipient.mockResolvedValue({
      id: "address-1",
      organizationId: "org-1",
      userId: "user-1",
      meta: JSON.stringify({
        maxReceivedEmailCount: 10,
        maxReceivedEmailAction: "rejectNew",
      }),
      expiresAt: null,
    });
    mocks.insertInboundEmail.mockResolvedValue({ inserted: false });

    await handleIncomingEmail(
      message as never,
      {} as CloudflareBindings,
      ctx as never
    );

    expect(message.setReject).not.toHaveBeenCalled();
    expect(mocks.recordAcceptedInboundEmailAbuse).not.toHaveBeenCalled();
    expect(mocks.decrementAddressEmailCount).toHaveBeenCalledWith(
      {},
      "address-1"
    );
    expect(mocks.persistRawEmailToR2).not.toHaveBeenCalled();
    expect(mocks.persistAttachments).not.toHaveBeenCalled();
  });
});
