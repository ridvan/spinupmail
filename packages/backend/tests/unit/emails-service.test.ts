import {
  getEmailDetail,
  getEmailAttachment,
  getEmailRaw,
  listEmails,
} from "@/modules/emails/service";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  findEmailAttachmentsByEmailAndOrganization: vi.fn(),
  findEmailDetailByIdAndOrganization: vi.fn(),
  findEmailRawSourceByIdAndOrganization: vi.fn(),
  findAttachmentByIdsAndOrganization: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/modules/emails/repo", () => ({
  decrementAddressEmailCount: vi.fn(),
  findAddressByIdAndOrganization: vi.fn(),
  findAddressByValueAndOrganization: vi.fn(),
  listEmailsForAddress: vi.fn(),
  findAttachmentCountsForEmails: vi.fn(),
  findEmailAttachmentsByEmailAndOrganization:
    mocks.findEmailAttachmentsByEmailAndOrganization,
  findEmailDetailByIdAndOrganization: mocks.findEmailDetailByIdAndOrganization,
  findEmailRawSourceByIdAndOrganization:
    mocks.findEmailRawSourceByIdAndOrganization,
  findAttachmentByIdsAndOrganization: mocks.findAttachmentByIdsAndOrganization,
  findEmailDeleteTargetByIdAndOrganization: vi.fn(),
  findAttachmentKeysByEmailAndOrganization: vi.fn(),
  deleteEmailByIdAndAddress: vi.fn(),
}));

describe("emails service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockReturnValue({});
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
      from: "sender@example.com",
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
