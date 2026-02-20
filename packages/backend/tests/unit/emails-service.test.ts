import {
  getEmailAttachment,
  getEmailRaw,
  listEmails,
} from "@/modules/emails/service";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
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
  findEmailDetailByIdAndOrganization: vi.fn(),
  findEmailAttachmentsByEmailAndOrganization: vi.fn(),
  findEmailRawSourceByIdAndOrganization:
    mocks.findEmailRawSourceByIdAndOrganization,
  findAttachmentByIdsAndOrganization: mocks.findAttachmentByIdsAndOrganization,
  findEmailDeleteTargetByIdAndOrganization: vi.fn(),
  findAttachmentKeysByEmailAndOrganization: vi.fn(),
  deleteEmailByIdAndAddress: vi.fn(),
}));

describe("emails service", () => {
  beforeEach(() => {
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
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("content-disposition")).toContain("report");
    expect(await response.text()).toBe("hello");
  });
});
