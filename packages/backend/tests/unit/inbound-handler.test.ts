import { handleIncomingEmail } from "@/modules/inbound-email/handler";

const mocks = vi.hoisted(() => ({
  findAddressByRecipient: vi.fn(),
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
  getDb: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/modules/inbound-email/repo", () => ({
  findAddressByRecipient: mocks.findAddressByRecipient,
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
    mocks.sanitizeEmailHtml.mockReturnValue("<p>Hello</p>");
    mocks.capTextForStorage.mockImplementation(value => value);
    mocks.persistRawEmailToR2.mockResolvedValue(undefined);
    mocks.persistAttachments.mockResolvedValue(undefined);
    mocks.reserveInboxSlot.mockResolvedValue(true);
    mocks.incrementAddressEmailCount.mockResolvedValue(undefined);
    mocks.decrementAddressEmailCount.mockResolvedValue(undefined);
    mocks.resetAddressEmailCount.mockResolvedValue(undefined);
    mocks.deleteEmailsForAddress.mockResolvedValue(undefined);
    mocks.deleteR2ObjectsByPrefix.mockResolvedValue(undefined);
    mocks.insertInboundEmail.mockResolvedValue(undefined);
    mocks.shouldAcceptSenderDomain.mockReturnValue({
      allowed: true,
      allowedFromDomains: [],
      senderDomain: "example.com",
    });
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
    mocks.reserveInboxSlot.mockResolvedValue(false);

    await handleIncomingEmail(
      message as never,
      {} as CloudflareBindings,
      ctx as never
    );

    expect(message.setReject).toHaveBeenCalledWith(
      "Address inbox limit reached"
    );
    expect(mocks.deleteEmailsForAddress).not.toHaveBeenCalled();
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
    mocks.reserveInboxSlot
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

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
    expect(mocks.persistRawEmailToR2).toHaveBeenCalledTimes(1);
    expect(mocks.persistAttachments).toHaveBeenCalledTimes(1);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(2);
    expect(message.forward).toHaveBeenCalledWith("dest@example.com");
  });
});
