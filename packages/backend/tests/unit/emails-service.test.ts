import {
  deleteEmail,
  getEmailDetail,
  getEmailAttachment,
  getEmailRaw,
  listEmails,
} from "@/modules/emails/service";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  findAddressByIdAndOrganization: vi.fn(),
  findAddressByValueAndOrganization: vi.fn(),
  listEmailsForAddress: vi.fn(),
  searchEmailsForAddress: vi.fn(),
  findAttachmentCountsForEmails: vi.fn(),
  findEmailAttachmentsByEmailAndOrganization: vi.fn(),
  findEmailDetailByIdAndOrganization: vi.fn(),
  findEmailRawSourceByIdAndOrganization: vi.fn(),
  findAttachmentByIdsAndOrganization: vi.fn(),
  buildDeleteEmailByIdAndAddressStatement: vi.fn(),
  buildDeleteEmailSearchEntryByEmailIdStatement: vi.fn(),
  buildDecrementAddressEmailCountStatement: vi.fn(),
  findEmailDeleteTargetByIdAndOrganization: vi.fn(),
  findAttachmentKeysByEmailAndOrganization: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/modules/emails/repo", () => ({
  buildDecrementAddressEmailCountStatement:
    mocks.buildDecrementAddressEmailCountStatement,
  buildDeleteEmailByIdAndAddressStatement:
    mocks.buildDeleteEmailByIdAndAddressStatement,
  buildDeleteEmailSearchEntryByEmailIdStatement:
    mocks.buildDeleteEmailSearchEntryByEmailIdStatement,
  findAddressByIdAndOrganization: mocks.findAddressByIdAndOrganization,
  findAddressByValueAndOrganization: mocks.findAddressByValueAndOrganization,
  listEmailsForAddress: mocks.listEmailsForAddress,
  searchEmailsForAddress: mocks.searchEmailsForAddress,
  findAttachmentCountsForEmails: mocks.findAttachmentCountsForEmails,
  findEmailAttachmentsByEmailAndOrganization:
    mocks.findEmailAttachmentsByEmailAndOrganization,
  findEmailDetailByIdAndOrganization: mocks.findEmailDetailByIdAndOrganization,
  findEmailRawSourceByIdAndOrganization:
    mocks.findEmailRawSourceByIdAndOrganization,
  findAttachmentByIdsAndOrganization: mocks.findAttachmentByIdsAndOrganization,
  findEmailDeleteTargetByIdAndOrganization:
    mocks.findEmailDeleteTargetByIdAndOrganization,
  findAttachmentKeysByEmailAndOrganization:
    mocks.findAttachmentKeysByEmailAndOrganization,
}));

describe("emails service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockReturnValue({});
    mocks.findAttachmentCountsForEmails.mockResolvedValue([]);
    mocks.findAttachmentKeysByEmailAndOrganization.mockResolvedValue([]);
  });

  it("requires address or addressId when listing emails", async () => {
    const result = await listEmails({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      queryPayload: {},
    });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({ error: "address or addressId is required" });
  });

  it("returns 404 when raw source is missing", async () => {
    mocks.findEmailRawSourceByIdAndOrganization.mockResolvedValue(null);

    const response = await getEmailRaw({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      emailId: "email-1",
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "email not found" });
  });

  it("returns parsed sender fields when listing emails", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "inbox@example.com",
    });
    mocks.listEmailsForAddress.mockResolvedValue([
      {
        id: "email-1",
        addressId: "address-1",
        to: "inbox@example.com",
        sender: "John Smith <john@example.com>",
        from: "john@example.com",
        subject: "Hello",
        messageId: "message-1",
        rawSize: 123,
        rawTruncated: false,
        receivedAt: new Date("2026-03-09T00:00:00.000Z"),
        hasHtml: 1,
        hasText: 0,
      },
    ]);
    mocks.findAttachmentCountsForEmails.mockResolvedValue([
      { emailId: "email-1", count: 2 },
    ]);

    const result = await listEmails({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      queryPayload: { addressId: "address-1" },
    });

    expect(result.status).toBe(200);
    expect(result.body.items[0]).toMatchObject({
      from: "john@example.com",
      sender: "John Smith <john@example.com>",
      senderLabel: "John Smith",
      attachmentCount: 2,
    });
  });

  it("falls back to from address for senderLabel when sender is null", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "inbox@example.com",
    });
    mocks.listEmailsForAddress.mockResolvedValue([
      {
        id: "email-1",
        addressId: "address-1",
        to: "inbox@example.com",
        sender: null,
        from: "noname@example.com",
        subject: "Hello",
        messageId: null,
        rawSize: 50,
        rawTruncated: false,
        receivedAt: new Date("2026-03-09T00:00:00.000Z"),
        hasHtml: 0,
        hasText: 1,
      },
    ]);

    const result = await listEmails({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      queryPayload: { addressId: "address-1" },
    });

    expect(result.status).toBe(200);
    expect(result.body.items[0]).toMatchObject({
      sender: null,
      senderLabel: "noname@example.com",
    });
  });

  it("uses ranked search when a search query is provided", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "inbox@example.com",
    });
    mocks.searchEmailsForAddress.mockResolvedValue([
      {
        id: "email-2",
        addressId: "address-1",
        to: "inbox@example.com",
        sender: "Jane Smith <jane@example.com>",
        from: "jane@example.com",
        subject: "Reset your password",
        messageId: "message-2",
        rawSize: 99,
        rawTruncated: false,
        receivedAt: new Date("2026-03-10T00:00:00.000Z"),
        hasHtml: 1,
        hasText: 1,
      },
    ]);

    const result = await listEmails({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      queryPayload: {
        addressId: "address-1",
        search: "  reset   pass  ",
        limit: "10",
      },
    });

    expect(mocks.searchEmailsForAddress).toHaveBeenCalledWith({
      db: {},
      addressId: "address-1",
      search: "reset pass",
      limit: 10,
    });
    expect(mocks.listEmailsForAddress).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
    expect(result.body.items[0]).toMatchObject({
      id: "email-2",
      senderLabel: "Jane Smith",
      subject: "Reset your password",
    });
  });

  it("caps search queries to 30 characters before searching", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "inbox@example.com",
    });
    mocks.searchEmailsForAddress.mockResolvedValue([]);

    const overlongSearch =
      "123456789012345678901234567890-overflow text that should not survive";

    const result = await listEmails({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      queryPayload: {
        addressId: "address-1",
        search: overlongSearch,
      },
    });

    expect(mocks.searchEmailsForAddress).toHaveBeenCalledWith({
      db: {},
      addressId: "address-1",
      search: overlongSearch.slice(0, 30),
      limit: 20,
    });
    expect(result.status).toBe(200);
  });

  it("rejects search requests that also pass after, before, or order", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "inbox@example.com",
    });

    const result = await listEmails({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      queryPayload: {
        addressId: "address-1",
        search: "reset",
        after: "2026-03-10T00:00:00.000Z",
        order: "asc",
      },
    });

    expect(mocks.searchEmailsForAddress).not.toHaveBeenCalled();
    expect(mocks.listEmailsForAddress).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 400,
      body: {
        error: "search does not support after, before, or order=asc parameters",
      },
    });
  });

  it("deletes the email row, FTS entry, and count in one batch", async () => {
    const deleteEmailStatement = { query: "delete email" };
    const deleteSearchStatement = { query: "delete search" };
    const decrementCountStatement = { query: "decrement count" };
    const batch = vi.fn().mockResolvedValue([]);
    const db = {
      $client: {
        batch,
      },
    };

    mocks.getDb.mockReturnValue(db);
    mocks.findEmailDeleteTargetByIdAndOrganization.mockResolvedValue({
      id: "email-1",
      addressId: "address-1",
    });
    mocks.findAttachmentKeysByEmailAndOrganization.mockResolvedValue([]);
    mocks.buildDeleteEmailByIdAndAddressStatement.mockReturnValue(
      deleteEmailStatement
    );
    mocks.buildDeleteEmailSearchEntryByEmailIdStatement.mockReturnValue(
      deleteSearchStatement
    );
    mocks.buildDecrementAddressEmailCountStatement.mockReturnValue(
      decrementCountStatement
    );

    const result = await deleteEmail({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      emailId: "email-1",
    });

    expect(mocks.buildDeleteEmailByIdAndAddressStatement).toHaveBeenCalledWith(
      db,
      "email-1",
      "address-1"
    );
    expect(
      mocks.buildDeleteEmailSearchEntryByEmailIdStatement
    ).toHaveBeenCalledWith(db, "email-1");
    expect(mocks.buildDecrementAddressEmailCountStatement).toHaveBeenCalledWith(
      db,
      "address-1"
    );
    expect(batch).toHaveBeenCalledWith([
      deleteEmailStatement,
      deleteSearchStatement,
      decrementCountStatement,
    ]);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 200,
      body: {
        id: "email-1",
        deleted: true,
      },
    });
  });

  it("streams raw email from DB when stored inline", async () => {
    mocks.findEmailRawSourceByIdAndOrganization.mockResolvedValue({
      id: "email-1",
      addressId: "address-1",
      raw: "RAW MIME",
    });

    const response = await getEmailRaw({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      emailId: "email-1",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("message/rfc822");
    expect(response.headers.get("content-disposition")).toContain(
      "email-1.eml"
    );
    expect(await response.text()).toBe("RAW MIME");
  });

  it("returns 404 when raw email is expected in R2 but object is missing", async () => {
    mocks.findEmailRawSourceByIdAndOrganization.mockResolvedValue({
      id: "email-1",
      addressId: "address-1",
      raw: null,
    });

    const response = await getEmailRaw({
      env: {
        R2_BUCKET: {
          get: vi.fn().mockResolvedValue(null),
        },
      } as unknown as CloudflareBindings,
      organizationId: "org-1",
      emailId: "email-1",
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "raw source not available",
    });
  });

  it("returns 503 when attachment storage is not configured", async () => {
    const response = await getEmailAttachment({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      emailId: "email-1",
      attachmentId: "att-1",
      queryPayload: {},
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Attachment storage is not configured",
    });
  });

  it("returns 404 when attachment row does not exist", async () => {
    mocks.findAttachmentByIdsAndOrganization.mockResolvedValue(null);

    const response = await getEmailAttachment({
      env: {
        R2_BUCKET: {
          get: vi.fn(),
        },
      } as unknown as CloudflareBindings,
      organizationId: "org-1",
      emailId: "email-1",
      attachmentId: "att-1",
      queryPayload: {},
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "attachment not found" });
  });

  it("returns attachment content with safe download headers", async () => {
    mocks.findAttachmentByIdsAndOrganization.mockResolvedValue({
      r2Key: "email-attachments/org/address/email/att-report.txt",
      contentType: "text/plain",
      filename: '../../report\\".txt',
      size: 5,
    });

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("hello"));
        controller.close();
      },
    });

    const response = await getEmailAttachment({
      env: {
        R2_BUCKET: {
          get: vi.fn().mockResolvedValue({ body }),
        },
      } as unknown as CloudflareBindings,
      organizationId: "org-1",
      emailId: "email-1",
      attachmentId: "att-1",
      queryPayload: {},
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("content-disposition")).toContain("report");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("hello");
  });

  it("rewrites cid references to inline attachment URLs on email detail", async () => {
    mocks.findEmailDetailByIdAndOrganization.mockResolvedValue({
      id: "email-1",
      addressId: "address-1",
      address: "inbox@example.com",
      to: "inbox@example.com",
      sender: "John Smith <john@example.com>",
      from: "john@example.com",
      subject: "Hello",
      messageId: "message-1",
      headers: "[]",
      bodyHtml:
        '<style>.hero{background-image:url("cid:bg-1")}</style><img src="cid:image-1" srcset="cid:image-1 1x, cid:bg-1 2x, cid:missing 3x" /><img src="cid:missing" />',
      bodyText: "Hello",
      raw: null,
      rawSize: 123,
      rawTruncated: false,
      receivedAt: new Date("2026-03-09T00:00:00.000Z"),
    });
    mocks.findEmailAttachmentsByEmailAndOrganization.mockResolvedValue([
      {
        id: "att-image",
        emailId: "email-1",
        filename: "hero.png",
        contentType: "image/png",
        size: 12,
        disposition: "inline",
        contentId: "<image-1>",
      },
      {
        id: "att-bg",
        emailId: "email-1",
        filename: "bg.png",
        contentType: "image/png",
        size: 10,
        disposition: "inline",
        contentId: "bg-1",
      },
    ]);

    const result = await getEmailDetail({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      emailId: "email-1",
      queryPayload: {},
    });

    expect(result.status).toBe(200);
    expect(result.body.attachments[0]?.inlinePath).toBe(
      "/api/emails/email-1/attachments/att-image?inline=1"
    );
    expect(result.body.sender).toBe("John Smith <john@example.com>");
    expect(result.body.senderLabel).toBe("John Smith");
    expect(result.body.html).toContain(
      "/api/emails/email-1/attachments/att-image?inline=1"
    );
    expect(result.body.html).toContain(
      "/api/emails/email-1/attachments/att-bg?inline=1"
    );
    expect(result.body.html).toContain(
      'srcset="/api/emails/email-1/attachments/att-image?inline=1 1x, /api/emails/email-1/attachments/att-bg?inline=1 2x"'
    );
    expect(result.body.html).not.toContain("cid:missing");
  });

  it("rejects inline rendering for non-image attachments", async () => {
    mocks.findAttachmentByIdsAndOrganization.mockResolvedValue({
      r2Key: "email-attachments/org/address/email/att-report.pdf",
      contentType: "application/pdf",
      filename: "report.pdf",
      size: 42,
    });

    const response = await getEmailAttachment({
      env: {
        R2_BUCKET: {
          get: vi.fn(),
        },
      } as unknown as CloudflareBindings,
      organizationId: "org-1",
      emailId: "email-1",
      attachmentId: "att-1",
      queryPayload: { inline: "1" },
    });

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({
      error: "attachment content cannot be rendered inline",
    });
  });

  it("serves inline image attachments with hardened headers", async () => {
    mocks.findAttachmentByIdsAndOrganization.mockResolvedValue({
      r2Key: "email-attachments/org/address/email/att-image.png",
      contentType: "image/png",
      filename: "画像.png",
      size: 5,
    });

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("hello"));
        controller.close();
      },
    });

    const response = await getEmailAttachment({
      env: {
        R2_BUCKET: {
          get: vi.fn().mockResolvedValue({ body }),
        },
      } as unknown as CloudflareBindings,
      organizationId: "org-1",
      emailId: "email-1",
      attachmentId: "att-1",
      queryPayload: { inline: "1" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("inline");
    expect(response.headers.get("content-disposition")).toContain(
      "filename*=UTF-8''%E7%94%BB%E5%83%8F.png"
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("hello");
  });
});
