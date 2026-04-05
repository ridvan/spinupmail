const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  countRecentAddressActivity: vi.fn(),
  findAddressByIdAndOrganization: vi.fn(),
  findAddressByValue: vi.fn(),
  insertAddress: vi.fn(),
  listRecentAddressActivityPage: vi.fn(),
  deleteAddressByIdAndOrganization: vi.fn(),
  deleteEmailSearchEntriesByAddressId: vi.fn(),
  deleteR2ObjectsByPrefix: vi.fn(),
  updateAddressByIdAndOrganization: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/modules/email-addresses/repo", () => ({
  countRecentAddressActivity: mocks.countRecentAddressActivity,
  findAddressByValue: mocks.findAddressByValue,
  findAddressByIdAndOrganization: mocks.findAddressByIdAndOrganization,
  insertAddress: mocks.insertAddress,
  listRecentAddressActivityPage: mocks.listRecentAddressActivityPage,
  deleteAddressByIdAndOrganization: mocks.deleteAddressByIdAndOrganization,
  updateAddressByIdAndOrganization: mocks.updateAddressByIdAndOrganization,
}));

vi.mock("@/modules/emails/repo", () => ({
  deleteEmailSearchEntriesByAddressId:
    mocks.deleteEmailSearchEntriesByAddressId,
}));

vi.mock("@/shared/utils/r2", () => ({
  deleteR2ObjectsByPrefix: mocks.deleteR2ObjectsByPrefix,
}));

import {
  createEmailAddress,
  deleteEmailAddress,
  listRecentAddressActivity,
  updateEmailAddress,
} from "@/modules/email-addresses/service";

describe("email addresses service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockReturnValue({});
    mocks.insertAddress.mockResolvedValue(true);
    mocks.countRecentAddressActivity.mockResolvedValue({ count: 0 });
    mocks.listRecentAddressActivityPage.mockResolvedValue([]);
    mocks.updateAddressByIdAndOrganization.mockResolvedValue(undefined);
    mocks.deleteAddressByIdAndOrganization.mockResolvedValue(undefined);
    mocks.deleteEmailSearchEntriesByAddressId.mockResolvedValue(undefined);
    mocks.deleteR2ObjectsByPrefix.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates an address with normalized policy controls and TTL metadata", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:34:56.000Z"));

    const result = await createEmailAddress({
      env: {
        EMAIL_DOMAINS: "spinupmail.com",
      } as CloudflareBindings,
      session: {
        session: { id: "session-1", userId: "user-1" },
        user: { id: "user-1", emailVerified: true },
      },
      organizationId: "org-1",
      payload: {
        localPart: "Project.Team+VIP",
        acceptedRiskNotice: true,
        ttlMinutes: 60,
        meta: {
          label: "VIP inbox",
        },
        allowedFromDomains: [" Foo.com ", "foo.com"],
        blockedSenderDomains: "Bad.com, mail.Bad.com",
        inboundRatePolicy: {
          senderDomainSoftMax: 5,
          senderDomainSoftWindowSeconds: 60,
        },
        maxReceivedEmailCount: 20,
        maxReceivedEmailAction: "rejectNew",
      },
    });

    expect(mocks.insertAddress).toHaveBeenCalledTimes(1);
    const insertCall = mocks.insertAddress.mock.calls[0];
    expect(insertCall?.[0]).toEqual({});
    expect(insertCall?.[2]).toBe(100);
    expect(insertCall?.[1]).toEqual(
      expect.objectContaining({
        organizationId: "org-1",
        userId: "user-1",
        address: "project.team+vip@spinupmail.com",
        localPart: "project.team+vip",
        domain: "spinupmail.com",
        expiresAt: new Date("2026-03-28T13:34:56.000Z"),
      })
    );
    expect(JSON.parse(insertCall?.[1]?.meta as string)).toEqual({
      label: "VIP inbox",
      allowedFromDomains: ["foo.com"],
      blockedSenderDomains: ["bad.com", "mail.bad.com"],
      inboundRatePolicy: {
        senderDomainSoftMax: 5,
        senderDomainSoftWindowSeconds: 60,
      },
      maxReceivedEmailCount: 20,
      maxReceivedEmailAction: "rejectNew",
    });

    expect(result).toEqual({
      status: 200,
      body: {
        id: expect.any(String),
        address: "project.team+vip@spinupmail.com",
        localPart: "project.team+vip",
        domain: "spinupmail.com",
        meta: {
          label: "VIP inbox",
          allowedFromDomains: ["foo.com"],
          blockedSenderDomains: ["bad.com", "mail.bad.com"],
          inboundRatePolicy: {
            senderDomainSoftMax: 5,
            senderDomainSoftWindowSeconds: 60,
          },
          maxReceivedEmailCount: 20,
          maxReceivedEmailAction: "rejectNew",
        },
        allowedFromDomains: ["foo.com"],
        blockedSenderDomains: ["bad.com", "mail.bad.com"],
        inboundRatePolicy: {
          senderDomainSoftMax: 5,
          senderDomainSoftWindowSeconds: 60,
        },
        maxReceivedEmailCount: 20,
        maxReceivedEmailAction: "rejectNew",
        createdAt: "2026-03-28T12:34:56.000Z",
        createdAtMs: Date.parse("2026-03-28T12:34:56.000Z"),
        expiresAt: "2026-03-28T13:34:56.000Z",
        expiresAtMs: Date.parse("2026-03-28T13:34:56.000Z"),
      },
    });
  });

  it("returns the existing address id when creation hits a unique conflict", async () => {
    mocks.insertAddress.mockRejectedValueOnce(
      new Error("unique constraint failed: email_addresses.address")
    );
    mocks.findAddressByValue.mockResolvedValue({ id: "address-existing" });

    const result = await createEmailAddress({
      env: {
        EMAIL_DOMAINS: "spinupmail.com",
      } as CloudflareBindings,
      session: {
        session: { id: "session-1", userId: "user-1" },
        user: { id: "user-1", emailVerified: true },
      },
      organizationId: "org-1",
      payload: {
        localPart: "demo-team",
        acceptedRiskNotice: true,
      },
    });

    expect(mocks.findAddressByValue).toHaveBeenCalledWith(
      {},
      "demo-team@spinupmail.com"
    );
    expect(result).toEqual({
      status: 409,
      body: {
        error: "Address already exists",
        address: "demo-team@spinupmail.com",
        id: "address-existing",
      },
    });
  });

  it("forces the configured prefix when creating an address", async () => {
    const result = await createEmailAddress({
      env: {
        EMAIL_DOMAINS: "spinupmail.com",
        FORCED_MAIL_PREFIX: "Temp",
      } as CloudflareBindings,
      session: {
        session: { id: "session-1", userId: "user-1" },
        user: { id: "user-1", emailVerified: true },
      },
      organizationId: "org-1",
      payload: {
        localPart: "project-team",
        acceptedRiskNotice: true,
      },
    });

    expect(mocks.insertAddress).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        address: "temp-project-team@spinupmail.com",
        localPart: "temp-project-team",
      }),
      100
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: 200,
        body: expect.objectContaining({
          address: "temp-project-team@spinupmail.com",
          localPart: "temp-project-team",
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
        }),
      })
    );
  });

  it("stores the default inbox limit when create payload omits it", async () => {
    await createEmailAddress({
      env: {
        EMAIL_DOMAINS: "spinupmail.com",
        MAX_RECEIVED_EMAILS_PER_ADDRESS: "25",
      } as CloudflareBindings,
      session: {
        session: { id: "session-1", userId: "user-1" },
        user: { id: "user-1", emailVerified: true },
      },
      organizationId: "org-1",
      payload: {
        localPart: "demo-team",
        acceptedRiskNotice: true,
      },
    });

    expect(
      JSON.parse(mocks.insertAddress.mock.calls[0]?.[1]?.meta as string)
    ).toEqual({
      maxReceivedEmailCount: 25,
      maxReceivedEmailAction: "cleanAll",
    });
  });

  it("returns the organization address limit error when no insert slot is available", async () => {
    mocks.insertAddress.mockResolvedValue(false);

    const result = await createEmailAddress({
      env: {
        EMAIL_DOMAINS: "spinupmail.com",
        MAX_ADDRESSES_PER_ORGANIZATION: "3",
      } as CloudflareBindings,
      session: {
        session: { id: "session-1", userId: "user-1" },
        user: { id: "user-1", emailVerified: true },
      },
      organizationId: "org-1",
      payload: {
        localPart: "demo-team",
        acceptedRiskNotice: true,
      },
    });

    expect(result).toEqual({
      status: 409,
      body: {
        error:
          "Address limit reached. Each organization can create up to 3 addresses.",
      },
    });
  });

  it("rejects address inbox limits above the configured hard cap on create", async () => {
    const result = await createEmailAddress({
      env: {
        EMAIL_DOMAINS: "spinupmail.com",
        MAX_RECEIVED_EMAILS_PER_ADDRESS: "25",
      } as CloudflareBindings,
      session: {
        session: { id: "session-1", userId: "user-1" },
        user: { id: "user-1", emailVerified: true },
      },
      organizationId: "org-1",
      payload: {
        localPart: "demo-team",
        acceptedRiskNotice: true,
        maxReceivedEmailCount: 26,
        maxReceivedEmailAction: "cleanAll",
      },
    });

    expect(mocks.insertAddress).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 400,
      body: {
        error: "maxReceivedEmailCount must be a whole number between 1 and 25",
      },
    });
  });

  it("rejects reserved local parts before any insert attempt", async () => {
    const result = await createEmailAddress({
      env: {
        EMAIL_DOMAINS: "spinupmail.com",
      } as CloudflareBindings,
      session: {
        session: { id: "session-1", userId: "user-1" },
        user: { id: "user-1", emailVerified: true },
      },
      organizationId: "org-1",
      payload: {
        localPart: "support",
        acceptedRiskNotice: true,
      },
    });

    expect(mocks.insertAddress).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 400,
      body: { error: "localPart is reserved and cannot be used" },
    });
  });

  it("paginates recent address activity with a stable cursor", async () => {
    mocks.countRecentAddressActivity.mockResolvedValue({ count: 3 });
    mocks.listRecentAddressActivityPage.mockResolvedValue([
      {
        id: "address-3",
        address: "support@spinupmail.com",
        localPart: "support",
        domain: "spinupmail.com",
        meta: JSON.stringify({ label: "Support" }),
        emailCount: 8,
        createdAt: new Date("2026-03-20T10:00:00.000Z"),
        expiresAt: null,
        lastReceivedAt: new Date("2026-03-28T12:00:00.000Z"),
        recentActivityMs: Date.parse("2026-03-28T12:00:00.000Z"),
        sortValueMs: Date.parse("2026-03-28T12:00:00.000Z"),
      },
      {
        id: "address-2",
        address: "sales@spinupmail.com",
        localPart: "sales",
        domain: "spinupmail.com",
        meta: null,
        emailCount: 3,
        createdAt: new Date("2026-03-19T10:00:00.000Z"),
        expiresAt: null,
        lastReceivedAt: new Date("2026-03-27T12:00:00.000Z"),
        recentActivityMs: Date.parse("2026-03-27T12:00:00.000Z"),
        sortValueMs: Date.parse("2026-03-27T12:00:00.000Z"),
      },
      {
        id: "address-1",
        address: "ops@spinupmail.com",
        localPart: "ops",
        domain: "spinupmail.com",
        meta: null,
        emailCount: 1,
        createdAt: new Date("2026-03-18T10:00:00.000Z"),
        expiresAt: null,
        lastReceivedAt: new Date("2026-03-26T12:00:00.000Z"),
        recentActivityMs: Date.parse("2026-03-26T12:00:00.000Z"),
        sortValueMs: Date.parse("2026-03-26T12:00:00.000Z"),
      },
    ]);

    const result = await listRecentAddressActivity({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      queryPayload: {
        limit: "2",
        search: "sales",
        sortBy: "recentActivity",
        sortDirection: "desc",
      },
    });

    expect(mocks.countRecentAddressActivity).toHaveBeenCalledWith({
      db: {},
      organizationId: "org-1",
      search: "sales",
    });
    expect(mocks.listRecentAddressActivityPage).toHaveBeenCalledWith({
      db: {},
      organizationId: "org-1",
      limit: 2,
      cursor: undefined,
      sortBy: "recentActivity",
      sortDirection: "desc",
      search: "sales",
    });
    expect(result).toEqual({
      status: 200,
      body: {
        items: [
          expect.objectContaining({
            id: "address-3",
            address: "support@spinupmail.com",
          }),
          expect.objectContaining({
            id: "address-2",
            address: "sales@spinupmail.com",
          }),
        ],
        nextCursor: `${Date.parse("2026-03-27T12:00:00.000Z")}:address-2`,
        totalItems: 3,
      },
    });
  });

  it("rejects malformed recent-activity cursors", async () => {
    const result = await listRecentAddressActivity({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      queryPayload: {
        cursor: "bad-cursor",
      },
    });

    expect(mocks.countRecentAddressActivity).not.toHaveBeenCalled();
    expect(mocks.listRecentAddressActivityPage).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 400,
      body: { error: "invalid cursor" },
    });
  });

  it("resets inbox limits to the default cap when updating an address back to defaults", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "project@spinupmail.com",
      localPart: "project",
      domain: "spinupmail.com",
      meta: JSON.stringify({
        label: "Project",
        allowedFromDomains: ["foo.com"],
        blockedSenderDomains: ["bad.com"],
        inboundRatePolicy: {
          senderDomainSoftMax: 5,
        },
        maxReceivedEmailCount: 10,
        maxReceivedEmailAction: "rejectNew",
      }),
      emailCount: 7,
      createdAt: new Date("2026-03-20T10:00:00.000Z"),
      expiresAt: new Date("2026-03-29T10:00:00.000Z"),
      lastReceivedAt: new Date("2026-03-28T12:00:00.000Z"),
    });

    const result = await updateEmailAddress({
      env: {
        EMAIL_DOMAINS: "spinupmail.com",
      } as CloudflareBindings,
      organizationId: "org-1",
      addressId: "address-1",
      payload: {
        meta: null,
        allowedFromDomains: [],
        blockedSenderDomains: null,
        inboundRatePolicy: null,
        maxReceivedEmailCount: null,
        ttlMinutes: null,
      },
    });

    expect(mocks.updateAddressByIdAndOrganization).toHaveBeenCalledWith({
      db: {},
      addressId: "address-1",
      organizationId: "org-1",
      values: {
        address: "project@spinupmail.com",
        localPart: "project",
        domain: "spinupmail.com",
        meta: JSON.stringify({
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
        }),
        expiresAt: null,
      },
    });
    expect(result).toEqual({
      status: 200,
      body: {
        id: "address-1",
        address: "project@spinupmail.com",
        localPart: "project",
        domain: "spinupmail.com",
        meta: {
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
        },
        emailCount: 7,
        allowedFromDomains: [],
        blockedSenderDomains: [],
        inboundRatePolicy: null,
        maxReceivedEmailCount: 100,
        maxReceivedEmailAction: "cleanAll",
        createdAt: "2026-03-20T10:00:00.000Z",
        createdAtMs: Date.parse("2026-03-20T10:00:00.000Z"),
        expiresAt: null,
        expiresAtMs: null,
        lastReceivedAt: "2026-03-28T12:00:00.000Z",
        lastReceivedAtMs: Date.parse("2026-03-28T12:00:00.000Z"),
      },
    });
  });

  it("rejects address inbox limits above the configured hard cap on update", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "project@spinupmail.com",
      localPart: "project",
      domain: "spinupmail.com",
      meta: null,
      emailCount: 2,
      createdAt: new Date("2026-03-20T10:00:00.000Z"),
      expiresAt: null,
      lastReceivedAt: null,
    });

    const result = await updateEmailAddress({
      env: {
        EMAIL_DOMAINS: "spinupmail.com",
        MAX_RECEIVED_EMAILS_PER_ADDRESS: "25",
      } as CloudflareBindings,
      organizationId: "org-1",
      addressId: "address-1",
      payload: {
        maxReceivedEmailCount: 26,
        maxReceivedEmailAction: "cleanAll",
      },
    });

    expect(mocks.updateAddressByIdAndOrganization).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 400,
      body: {
        error: "maxReceivedEmailCount must be a whole number between 1 and 25",
      },
    });
  });

  it("allows updates when a carried-forward inbox limit is above the current hard cap", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "project@spinupmail.com",
      localPart: "project",
      domain: "spinupmail.com",
      meta: JSON.stringify({
        maxReceivedEmailCount: 100,
        maxReceivedEmailAction: "rejectNew",
      }),
      emailCount: 2,
      createdAt: new Date("2026-03-20T10:00:00.000Z"),
      expiresAt: new Date("2026-03-29T10:00:00.000Z"),
      lastReceivedAt: null,
    });

    const result = await updateEmailAddress({
      env: {
        EMAIL_DOMAINS: "spinupmail.com",
        MAX_RECEIVED_EMAILS_PER_ADDRESS: "25",
      } as CloudflareBindings,
      organizationId: "org-1",
      addressId: "address-1",
      payload: {
        ttlMinutes: null,
      },
    });

    expect(mocks.updateAddressByIdAndOrganization).toHaveBeenCalledWith({
      db: {},
      addressId: "address-1",
      organizationId: "org-1",
      values: {
        address: "project@spinupmail.com",
        localPart: "project",
        domain: "spinupmail.com",
        meta: JSON.stringify({
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "rejectNew",
        }),
        expiresAt: null,
      },
    });
    expect(result).toEqual({
      status: 200,
      body: {
        id: "address-1",
        address: "project@spinupmail.com",
        localPart: "project",
        domain: "spinupmail.com",
        meta: {
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "rejectNew",
        },
        emailCount: 2,
        allowedFromDomains: [],
        blockedSenderDomains: [],
        inboundRatePolicy: null,
        maxReceivedEmailCount: 100,
        maxReceivedEmailAction: "rejectNew",
        createdAt: "2026-03-20T10:00:00.000Z",
        createdAtMs: Date.parse("2026-03-20T10:00:00.000Z"),
        expiresAt: null,
        expiresAtMs: null,
        lastReceivedAt: null,
        lastReceivedAtMs: null,
      },
    });
  });

  it("returns the conflicting id when an address update hits a unique conflict", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "project@spinupmail.com",
      localPart: "project",
      domain: "spinupmail.com",
      meta: null,
      emailCount: 2,
      createdAt: new Date("2026-03-20T10:00:00.000Z"),
      expiresAt: null,
      lastReceivedAt: null,
    });
    mocks.updateAddressByIdAndOrganization.mockRejectedValueOnce(
      new Error("unique constraint failed: email_addresses.address")
    );
    mocks.findAddressByValue.mockResolvedValue({ id: "address-2" });

    const result = await updateEmailAddress({
      env: {
        EMAIL_DOMAINS: "spinupmail.com",
      } as CloudflareBindings,
      organizationId: "org-1",
      addressId: "address-1",
      payload: {
        localPart: "demo-team",
      },
    });

    expect(mocks.findAddressByValue).toHaveBeenCalledWith(
      {},
      "demo-team@spinupmail.com"
    );
    expect(result).toEqual({
      status: 409,
      body: {
        error: "Address already exists",
        address: "demo-team@spinupmail.com",
        id: "address-2",
      },
    });
  });

  it("forces the configured prefix when updating the local part", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "project@spinupmail.com",
      localPart: "project",
      domain: "spinupmail.com",
      meta: null,
      emailCount: 2,
      createdAt: new Date("2026-03-20T10:00:00.000Z"),
      expiresAt: null,
      lastReceivedAt: null,
    });

    const result = await updateEmailAddress({
      env: {
        EMAIL_DOMAINS: "spinupmail.com",
        FORCED_MAIL_PREFIX: "temp",
      } as CloudflareBindings,
      organizationId: "org-1",
      addressId: "address-1",
      payload: {
        localPart: "project-v2",
      },
    });

    expect(mocks.updateAddressByIdAndOrganization).toHaveBeenCalledWith({
      db: {},
      addressId: "address-1",
      organizationId: "org-1",
      values: {
        address: "temp-project-v2@spinupmail.com",
        localPart: "temp-project-v2",
        domain: "spinupmail.com",
        meta: JSON.stringify({
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
        }),
        expiresAt: null,
      },
    });
    expect(result).toEqual({
      status: 200,
      body: {
        id: "address-1",
        address: "temp-project-v2@spinupmail.com",
        localPart: "temp-project-v2",
        domain: "spinupmail.com",
        meta: {
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
        },
        emailCount: 2,
        allowedFromDomains: [],
        blockedSenderDomains: [],
        inboundRatePolicy: null,
        maxReceivedEmailCount: 100,
        maxReceivedEmailAction: "cleanAll",
        createdAt: "2026-03-20T10:00:00.000Z",
        createdAtMs: Date.parse("2026-03-20T10:00:00.000Z"),
        expiresAt: null,
        expiresAtMs: null,
        lastReceivedAt: null,
        lastReceivedAtMs: null,
      },
    });
  });

  it("fails deletion when R2 cleanup fails and leaves db cleanup untouched", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "inbox@example.com",
    });
    mocks.deleteR2ObjectsByPrefix.mockRejectedValueOnce(new Error("r2 down"));

    const result = await deleteEmailAddress({
      env: {
        R2_BUCKET: {} as R2Bucket,
      } as CloudflareBindings,
      organizationId: "org-1",
      addressId: "address-1",
    });

    expect(mocks.deleteEmailSearchEntriesByAddressId).not.toHaveBeenCalled();
    expect(mocks.deleteAddressByIdAndOrganization).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 500,
      body: { error: "failed to clean up address files" },
    });
  });

  it("deletes FTS search rows before deleting the address record", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "inbox@example.com",
    });

    const result = await deleteEmailAddress({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      addressId: "address-1",
    });

    expect(mocks.deleteEmailSearchEntriesByAddressId).toHaveBeenCalledWith(
      {},
      "address-1"
    );
    expect(mocks.deleteAddressByIdAndOrganization).toHaveBeenCalledWith(
      {},
      "address-1",
      "org-1"
    );
    expect(
      mocks.deleteEmailSearchEntriesByAddressId.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mocks.deleteAddressByIdAndOrganization.mock.invocationCallOrder[0]
    );
    expect(result).toEqual({
      status: 200,
      body: {
        id: "address-1",
        address: "inbox@example.com",
        deleted: true,
      },
    });
  });
});
