import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  findAutoCreatedAddressByOrganization: vi.fn(),
  insertAddress: vi.fn(),
  listSampleEmailsForAddress: vi.fn(),
  insertInboundEmail: vi.fn(),
  updateAddressLastReceivedAt: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/modules/email-addresses/repo", () => ({
  findAutoCreatedAddressByOrganization:
    mocks.findAutoCreatedAddressByOrganization,
  insertAddress: mocks.insertAddress,
}));

vi.mock("@/modules/inbound-email/repo", () => ({
  listSampleEmailsForAddress: mocks.listSampleEmailsForAddress,
  insertInboundEmail: mocks.insertInboundEmail,
  updateAddressLastReceivedAt: mocks.updateAddressLastReceivedAt,
}));

import { seedStarterInbox } from "@/modules/organizations/starter-inbox";

describe("starter inbox provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockReturnValue({});
    mocks.findAutoCreatedAddressByOrganization.mockResolvedValue(null);
    mocks.insertAddress.mockResolvedValue(true);
    mocks.listSampleEmailsForAddress.mockResolvedValue([]);
    mocks.insertInboundEmail.mockResolvedValue({ inserted: true });
    mocks.updateAddressLastReceivedAt.mockResolvedValue(undefined);
  });

  it("creates one auto-created address and seeds three sample emails", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const uuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("suffix-uuid")
      .mockReturnValueOnce("addr-uuid")
      .mockReturnValueOnce("sample-1")
      .mockReturnValueOnce("sample-2")
      .mockReturnValueOnce("sample-3");

    const result = await seedStarterInbox({
      env: { EMAIL_DOMAINS: "spinupmail.com" } as CloudflareBindings,
      organizationId: "org-1",
      userId: "user-1",
      organizationName: "Acme Org",
    });

    expect(mocks.insertAddress).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        organizationId: "org-1",
        userId: "user-1",
        domain: "spinupmail.com",
        autoCreated: true,
      }),
      100
    );
    expect(mocks.insertInboundEmail).toHaveBeenCalledTimes(3);
    expect(mocks.insertInboundEmail).toHaveBeenNthCalledWith(
      1,
      {},
      expect.objectContaining({
        addressId: "addr-uuid",
        isSample: true,
        raw: expect.stringContaining(
          'Content-Type: multipart/alternative; boundary="spinupmail-sample-sample-1"'
        ),
        to: expect.stringContaining("@spinupmail.com"),
      })
    );
    const firstEmail = mocks.insertInboundEmail.mock.calls[0]?.[1];
    expect(firstEmail?.bodyHtml).toContain("<!doctype html>");
    expect(firstEmail?.bodyHtml).toContain('[data-spinupmail-theme="dark"]');
    expect(firstEmail?.rawSize).toBe(
      new TextEncoder().encode(firstEmail?.raw ?? "").length
    );
    expect(mocks.updateAddressLastReceivedAt).toHaveBeenCalledTimes(1);
    expect(result.starterAddressId).toBe("addr-uuid");
    expect(result.seededSampleEmailCount).toBe(3);
    expect(result.createdStarterAddress).toBe(true);

    randomSpy.mockRestore();
    uuidSpy.mockRestore();
  });

  it("escapes organization and address content in seeded html emails", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const uuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("suffix-uuid")
      .mockReturnValueOnce("addr-uuid")
      .mockReturnValueOnce("sample-1")
      .mockReturnValueOnce("sample-2")
      .mockReturnValueOnce("sample-3");

    await seedStarterInbox({
      env: { EMAIL_DOMAINS: "spinupmail.com" } as CloudflareBindings,
      organizationId: "org-1",
      userId: "user-1",
      organizationName: 'Acme Örg <Launch> & "Ship"',
    });

    const firstEmail = mocks.insertInboundEmail.mock.calls[0]?.[1];

    expect(firstEmail?.bodyHtml).toContain(
      "Welcome to Acme Örg &lt;Launch&gt; &amp; &quot;Ship&quot;"
    );
    expect(firstEmail?.bodyHtml).toContain("amber-harbor-suf@");
    expect(firstEmail?.bodyHtml).not.toContain(
      'Welcome to Acme Örg <Launch> & "Ship"'
    );
    expect(firstEmail?.rawSize).toBe(
      new TextEncoder().encode(firstEmail?.raw ?? "").length
    );

    randomSpy.mockRestore();
    uuidSpy.mockRestore();
  });

  it("retries address creation on collision", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const uuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("suffix-1")
      .mockReturnValueOnce("addr-1")
      .mockReturnValueOnce("suffix-2")
      .mockReturnValueOnce("addr-2")
      .mockReturnValueOnce("sample-1")
      .mockReturnValueOnce("sample-2")
      .mockReturnValueOnce("sample-3");
    mocks.insertAddress
      .mockRejectedValueOnce(
        new Error("UNIQUE constraint failed: email_addresses.address")
      )
      .mockResolvedValueOnce(true);

    await seedStarterInbox({
      env: { EMAIL_DOMAINS: "spinupmail.com" } as CloudflareBindings,
      organizationId: "org-1",
      userId: "user-1",
      organizationName: "Acme Org",
    });

    expect(mocks.insertAddress).toHaveBeenCalledTimes(2);
    randomSpy.mockRestore();
    uuidSpy.mockRestore();
  });

  it("reuses fully seeded auto-created addresses without inserting duplicates", async () => {
    const latestReceivedAt = new Date("2026-01-01T00:02:00.000Z");
    mocks.findAutoCreatedAddressByOrganization.mockResolvedValue({
      id: "address-1",
      address: "starter@spinupmail.com",
    });
    mocks.listSampleEmailsForAddress.mockResolvedValue([
      {
        subject: "Welcome to Spinupmail",
        receivedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        subject: "Send your first test email",
        receivedAt: latestReceivedAt,
      },
      {
        subject: "What to explore next",
        receivedAt: new Date("2026-01-01T00:01:00.000Z"),
      },
    ]);

    const result = await seedStarterInbox({
      env: { EMAIL_DOMAINS: "spinupmail.com" } as CloudflareBindings,
      organizationId: "org-1",
      userId: "user-1",
      organizationName: "Acme Org",
    });

    expect(mocks.insertAddress).not.toHaveBeenCalled();
    expect(mocks.insertInboundEmail).not.toHaveBeenCalled();
    expect(mocks.updateAddressLastReceivedAt).toHaveBeenCalledWith(
      {},
      "address-1",
      latestReceivedAt
    );
    expect(result).toEqual({
      starterAddressId: "address-1",
      starterAddress: "starter@spinupmail.com",
      seededSampleEmailCount: 0,
      createdStarterAddress: false,
    });
  });

  it("backfills missing sample emails for an existing auto-created address", async () => {
    const uuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("sample-2")
      .mockReturnValueOnce("sample-3");
    const existingReceivedAt = new Date("2026-01-01T00:00:00.000Z");

    mocks.findAutoCreatedAddressByOrganization.mockResolvedValue({
      id: "address-1",
      address: "starter@spinupmail.com",
    });
    mocks.listSampleEmailsForAddress.mockResolvedValue([
      {
        subject: "Welcome to Spinupmail",
        receivedAt: existingReceivedAt,
      },
    ]);

    const result = await seedStarterInbox({
      env: { EMAIL_DOMAINS: "spinupmail.com" } as CloudflareBindings,
      organizationId: "org-1",
      userId: "user-1",
      organizationName: "Acme Org",
    });

    expect(mocks.insertAddress).not.toHaveBeenCalled();
    expect(mocks.insertInboundEmail).toHaveBeenCalledTimes(2);
    expect(mocks.updateAddressLastReceivedAt).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      starterAddressId: "address-1",
      starterAddress: "starter@spinupmail.com",
      seededSampleEmailCount: 2,
      createdStarterAddress: false,
    });

    uuidSpy.mockRestore();
  });

  it("fails cleanly when EMAIL_DOMAINS is missing", async () => {
    await expect(
      seedStarterInbox({
        env: {} as CloudflareBindings,
        organizationId: "org-1",
        userId: "user-1",
        organizationName: "Acme Org",
      })
    ).rejects.toThrow("EMAIL_DOMAINS is not configured");
  });
});
