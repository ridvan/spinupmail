const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  findEmailActivity: vi.fn(),
  findEmailSummary: vi.fn(),
  findOrganizationCounts: vi.fn(),
  findOrganizationIdsForUser: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/modules/organizations/repo", () => ({
  findEmailActivity: mocks.findEmailActivity,
  findEmailSummary: mocks.findEmailSummary,
  findOrganizationCounts: mocks.findOrganizationCounts,
  findOrganizationIdsForUser: mocks.findOrganizationIdsForUser,
}));

import {
  getEmailActivityStats,
  getEmailSummaryStats,
  getOrganizationStats,
} from "@/modules/organizations/service";

describe("organization summary service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));
    mocks.getDb.mockReturnValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("excludes dormant inboxes created within the last 24 hours", async () => {
    mocks.findEmailSummary.mockResolvedValue({
      emailCountRow: [{ count: 12 }],
      attachmentStatsRows: [{ attachmentCount: 3, attachmentSizeTotal: 4096 }],
      topDomainsRows: [],
      busiestInboxesRows: [],
      dormantInboxesRows: [
        {
          addressId: "address-old",
          address: "old@example.com",
          createdAt: new Date("2026-03-21T11:00:00.000Z"),
        },
        {
          addressId: "address-boundary",
          address: "boundary@example.com",
          createdAt: new Date("2026-03-21T12:00:00.000Z"),
        },
        {
          addressId: "address-new",
          address: "new@example.com",
          createdAt: new Date("2026-03-21T13:00:00.000Z"),
        },
      ],
    });

    const result = await getEmailSummaryStats({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
    });

    expect(mocks.findEmailSummary).toHaveBeenCalledTimes(1);
    expect(mocks.findEmailSummary).toHaveBeenCalledWith(
      {},
      "org-1",
      expect.any(Date)
    );
    expect(
      (mocks.findEmailSummary.mock.calls[0]?.[2] as Date).toISOString()
    ).toBe("2026-03-21T12:00:00.000Z");
    expect(result.dormantInboxes).toEqual([
      {
        addressId: "address-old",
        address: "old@example.com",
        createdAt: "2026-03-21T11:00:00.000Z",
      },
      {
        addressId: "address-boundary",
        address: "boundary@example.com",
        createdAt: "2026-03-21T12:00:00.000Z",
      },
    ]);
    expect(result.attachmentSizeLimit).toBe(104857600);
  });

  it("returns organization stats in membership order with zero-filled counts", async () => {
    mocks.findOrganizationIdsForUser.mockResolvedValue(["org-2", "org-1"]);
    mocks.findOrganizationCounts.mockResolvedValue({
      memberCountRows: [{ organizationId: "org-1", count: 4 }],
      addressCountRows: [{ organizationId: "org-2", count: 7 }],
      emailCountRows: [
        { organizationId: "org-1", count: 15 },
        { organizationId: "org-2", count: 2 },
      ],
    });

    const result = await getOrganizationStats(
      {} as CloudflareBindings,
      "user-1"
    );

    expect(mocks.findOrganizationIdsForUser).toHaveBeenCalledWith({}, "user-1");
    expect(mocks.findOrganizationCounts).toHaveBeenCalledWith({}, [
      "org-2",
      "org-1",
    ]);
    expect(result).toEqual({
      items: [
        {
          organizationId: "org-2",
          memberCount: 0,
          addressCount: 7,
          emailCount: 2,
        },
        {
          organizationId: "org-1",
          memberCount: 4,
          addressCount: 0,
          emailCount: 15,
        },
      ],
    });
  });

  it("returns an empty list when the user has no organizations", async () => {
    mocks.findOrganizationIdsForUser.mockResolvedValue([]);

    const result = await getOrganizationStats(
      {} as CloudflareBindings,
      "user-1"
    );

    expect(mocks.findOrganizationCounts).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [] });
  });

  it("builds timezone-aware daily email activity from repo rows", async () => {
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));
    mocks.findEmailActivity.mockResolvedValue([
      {
        minuteStartMs: Date.parse("2026-03-21T23:30:00.000Z"),
        count: 1,
      },
      {
        minuteStartMs: Date.parse("2026-03-22T09:30:00.000Z"),
        count: 4,
      },
    ]);

    const result = await getEmailActivityStats({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      daysRaw: "2",
      timezoneRaw: "America/Los_Angeles",
    });

    expect(mocks.findEmailActivity).toHaveBeenCalledWith(
      {},
      "org-1",
      new Date("2026-03-18T12:00:00.000Z"),
      new Date("2026-03-22T12:01:00.000Z")
    );
    expect(result).toEqual({
      status: 200,
      body: {
        timezone: "America/Los_Angeles",
        daily: [
          { date: "2026-03-21", count: 1 },
          { date: "2026-03-22", count: 4 },
        ],
      },
    });
  });

  it("zeros attachment summary fields when attachments are disabled", async () => {
    mocks.findEmailSummary.mockResolvedValue({
      emailCountRow: [{ count: 12 }],
      attachmentStatsRows: [{ attachmentCount: 3, attachmentSizeTotal: 4096 }],
      topDomainsRows: [],
      busiestInboxesRows: [],
      dormantInboxesRows: [],
    });

    const result = await getEmailSummaryStats({
      env: {
        EMAIL_ATTACHMENTS_ENABLED: "false",
      } as CloudflareBindings,
      organizationId: "org-1",
    });

    expect(result.attachmentCount).toBe(0);
    expect(result.attachmentSizeTotal).toBe(0);
    expect(result.attachmentSizeLimit).toBe(0);
  });

  it("returns the configured attachment storage limit", async () => {
    mocks.findEmailSummary.mockResolvedValue({
      emailCountRow: [{ count: 12 }],
      attachmentStatsRows: [{ attachmentCount: 3, attachmentSizeTotal: 4096 }],
      topDomainsRows: [],
      busiestInboxesRows: [],
      dormantInboxesRows: [],
    });

    const result = await getEmailSummaryStats({
      env: {
        EMAIL_ATTACHMENT_MAX_TOTAL_BYTES_PER_ORGANIZATION: "209715200",
      } as CloudflareBindings,
      organizationId: "org-1",
    });

    expect(result.attachmentSizeLimit).toBe(209715200);
  });
});
