import { persistAttachments } from "@/modules/inbound-email/storage";
import { FakeR2Bucket } from "../fixtures/fake-r2";

const mocks = vi.hoisted(() => ({
  getOrganizationAttachmentStorageUsage: vi.fn(),
  insertEmailAttachmentIfOrganizationQuotaAllows: vi.fn(),
}));

vi.mock("@/modules/inbound-email/repo", () => ({
  getOrganizationAttachmentStorageUsage:
    mocks.getOrganizationAttachmentStorageUsage,
  insertEmailAttachmentIfOrganizationQuotaAllows:
    mocks.insertEmailAttachmentIfOrganizationQuotaAllows,
}));

const buildAttachment = (
  overrides: Partial<{
    filename: string;
    contentType: string;
    size: number;
    disposition: string;
    contentId: string | null;
  }> = {}
) => {
  const bytes = new TextEncoder().encode("hello world");

  return {
    filename: overrides.filename ?? "file.txt",
    contentType: overrides.contentType ?? "text/plain",
    size: overrides.size ?? bytes.length,
    disposition: overrides.disposition ?? "attachment",
    contentId: overrides.contentId ?? null,
    bytes,
  };
};

describe("inbound attachment storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationAttachmentStorageUsage.mockResolvedValue(0);
    mocks.insertEmailAttachmentIfOrganizationQuotaAllows.mockResolvedValue({
      inserted: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips attachments that would exceed the organization total quota", async () => {
    const bucket = new FakeR2Bucket();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.getOrganizationAttachmentStorageUsage.mockResolvedValue(95);

    await persistAttachments({
      attachments: [buildAttachment({ size: 10 })],
      env: {
        R2_BUCKET: bucket as unknown as R2Bucket,
        EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION: "100",
      } as CloudflareBindings,
      db: {} as never,
      emailId: "email-1",
      organizationId: "org-1",
      addressId: "address-1",
      userId: "user-1",
    });

    expect(
      mocks.insertEmailAttachmentIfOrganizationQuotaAllows
    ).not.toHaveBeenCalled();
    expect((await bucket.list()).objects).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("would exceed total attachment storage limit 100")
    );
  });

  it("tracks the running organization usage within a single email", async () => {
    const bucket = new FakeR2Bucket();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.getOrganizationAttachmentStorageUsage.mockResolvedValue(70);

    await persistAttachments({
      attachments: [
        buildAttachment({ filename: "first.txt", size: 20 }),
        buildAttachment({ filename: "second.txt", size: 15 }),
      ],
      env: {
        R2_BUCKET: bucket as unknown as R2Bucket,
        EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION: "100",
      } as CloudflareBindings,
      db: {} as never,
      emailId: "email-1",
      organizationId: "org-1",
      addressId: "address-1",
      userId: "user-1",
    });

    expect(
      mocks.insertEmailAttachmentIfOrganizationQuotaAllows
    ).toHaveBeenCalledTimes(1);
    expect((await bucket.list()).objects).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("would exceed total attachment storage limit 100")
    );
  });

  it("deletes uploaded objects when the DB quota guard rejects the insert", async () => {
    const bucket = new FakeR2Bucket();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.insertEmailAttachmentIfOrganizationQuotaAllows.mockResolvedValue({
      inserted: false,
    });

    await persistAttachments({
      attachments: [buildAttachment({ size: 20 })],
      env: {
        R2_BUCKET: bucket as unknown as R2Bucket,
        EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION: "100",
      } as CloudflareBindings,
      db: {} as never,
      emailId: "email-1",
      organizationId: "org-1",
      addressId: "address-1",
      userId: "user-1",
    });

    expect((await bucket.list()).objects).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("reached total attachment storage limit 100")
    );
  });

  it("falls back to insert-time quota enforcement when usage lookup fails", async () => {
    const bucket = new FakeR2Bucket();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.getOrganizationAttachmentStorageUsage.mockRejectedValue(
      new Error("transient D1 failure")
    );

    await expect(
      persistAttachments({
        attachments: [buildAttachment({ size: 20 })],
        env: {
          R2_BUCKET: bucket as unknown as R2Bucket,
          EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION: "100",
        } as CloudflareBindings,
        db: {} as never,
        emailId: "email-1",
        organizationId: "org-1",
        addressId: "address-1",
        userId: "user-1",
      })
    ).resolves.toBeUndefined();

    expect(
      mocks.insertEmailAttachmentIfOrganizationQuotaAllows
    ).toHaveBeenCalledTimes(1);
    expect((await bucket.list()).objects).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to load attachment storage usage for organization org-1"
      ),
      expect.any(Error)
    );
  });
});
