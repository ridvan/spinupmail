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

import { getEmailSummaryStats } from "@/modules/organizations/service";

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
  });
});
