const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  findAdminActivityRows: vi.fn(),
  findAdminOperationalEventsPage: vi.fn(),
  findAdminOrganizationRollups: vi.fn(),
  findAdminOrganizationsPage: vi.fn(),
  findAdminOverviewStats: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/modules/admin/repo", () => ({
  findAdminActivityRows: mocks.findAdminActivityRows,
  findAdminOperationalEventsPage: mocks.findAdminOperationalEventsPage,
  findAdminOrganizationRollups: mocks.findAdminOrganizationRollups,
  findAdminOrganizationsPage: mocks.findAdminOrganizationsPage,
  findAdminOverviewStats: mocks.findAdminOverviewStats,
}));

import {
  getAdminActivity,
  getAdminOperationalEvents,
  getAdminOrganizations,
  getAdminOverview,
  performAdminUserAction,
} from "@/modules/admin/service";

const createAdminActionDb = () => {
  const targetUser = {
    id: "target-user",
    email: "target@example.com",
  };
  const get = vi.fn().mockResolvedValue(targetUser);
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({ get })),
    })),
  }));
  const updateWhere = vi.fn();
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const deleteWhere = vi.fn();
  const deleteFrom = vi.fn(() => ({ where: deleteWhere }));
  const values = vi.fn();
  const insert = vi.fn(() => ({ values }));

  return {
    db: {
      select,
      update,
      delete: deleteFrom,
      insert,
    },
    set,
    updateWhere,
    insertValues: values,
  };
};

describe("admin service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00.000Z"));
    mocks.getDb.mockReturnValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds overview windows and keeps sample email counts separate", async () => {
    mocks.findAdminOverviewStats.mockResolvedValue({
      generatedAddresses: { current: 30, previous: 12 },
      receivedEmails: { current: 20, previous: 8 },
      sampleEmails: { current: 5, previous: 2 },
      organizations: 3,
      users: 9,
      activeUsers24h: 4,
      activeUsers7d: 6,
      attachments: { count: 7, sizeTotal: 4096 },
      integrations: { active: 2, retryScheduled: 1, failed: 0 },
      anomalies: { last24h: 2, errorsLast24h: 0, warningsLast24h: 1 },
    });

    const result = await getAdminOverview({} as CloudflareBindings);

    expect(mocks.findAdminOverviewStats).toHaveBeenCalledWith({
      db: {},
      currentRange: {
        from: new Date("2026-03-28T12:00:00.000Z"),
        to: new Date("2026-04-27T12:00:00.000Z"),
      },
      previousRange: {
        from: new Date("2026-02-26T12:00:00.000Z"),
        to: new Date("2026-03-28T12:00:00.000Z"),
      },
      active24hSince: new Date("2026-04-26T12:00:00.000Z"),
      active7dSince: new Date("2026-04-20T12:00:00.000Z"),
      anomalySince: new Date("2026-04-26T12:00:00.000Z"),
      now: new Date("2026-04-27T12:00:00.000Z"),
    });
    expect(result.receivedEmails.current).toBe(20);
    expect(result.sampleEmails.current).toBe(5);
    expect(result.system).toEqual({
      status: "warning",
      checkedAt: "2026-04-27T12:00:00.000Z",
    });
  });

  it("builds timezone-aware generated-address and received-email activity", async () => {
    mocks.findAdminActivityRows.mockResolvedValue({
      generatedAddressRows: [
        {
          minuteStartMs: Date.parse("2026-04-26T21:30:00.000Z"),
          count: 3,
        },
      ],
      receivedEmailRows: [
        {
          minuteStartMs: Date.parse("2026-04-27T08:30:00.000Z"),
          count: 4,
        },
      ],
    });

    const result = await getAdminActivity({
      env: {} as CloudflareBindings,
      daysRaw: 2,
      timezoneRaw: "Europe/Istanbul",
    });

    expect(result).toEqual({
      status: 200,
      body: {
        timezone: "Europe/Istanbul",
        daily: [
          {
            date: "2026-04-26",
            generatedAddresses: 0,
            receivedEmails: 0,
          },
          {
            date: "2026-04-27",
            generatedAddresses: 3,
            receivedEmails: 4,
          },
        ],
      },
    });
  });

  it("combines organization page rows with per-organization rollups", async () => {
    mocks.findAdminOrganizationsPage.mockResolvedValue({
      items: [
        {
          id: "org-1",
          name: "Acme",
          slug: "acme",
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
        },
      ],
      totalItems: 1,
    });
    mocks.findAdminOrganizationRollups.mockResolvedValue({
      memberRows: [{ organizationId: "org-1", count: 2 }],
      addressRows: [
        {
          organizationId: "org-1",
          count: 5,
          lastReceivedAt: new Date("2026-04-26T10:00:00.000Z"),
        },
      ],
      emailRows: [
        {
          organizationId: "org-1",
          receivedCount: 8,
          sampleCount: 3,
        },
      ],
      integrationRows: [
        {
          organizationId: "org-1",
          count: 4,
          activeCount: 2,
        },
      ],
    });

    const result = await getAdminOrganizations({
      env: {} as CloudflareBindings,
      pageRaw: 1,
      pageSizeRaw: 10,
    });

    expect(mocks.findAdminOrganizationRollups).toHaveBeenCalledWith({}, [
      "org-1",
    ]);
    expect(result.items).toEqual([
      {
        id: "org-1",
        name: "Acme",
        slug: "acme",
        createdAt: "2026-04-01T00:00:00.000Z",
        memberCount: 2,
        addressCount: 5,
        receivedEmailCount: 8,
        sampleEmailCount: 3,
        integrationCount: 4,
        activeIntegrationCount: 2,
        lastReceivedAt: "2026-04-26T10:00:00.000Z",
      },
    ]);
  });

  it("returns filtered operational events with parsed redacted metadata", async () => {
    mocks.findAdminOperationalEventsPage.mockResolvedValue({
      items: [
        {
          id: "event-1",
          severity: "error",
          type: "integration_dispatch_failed",
          organizationId: "org-1",
          addressId: null,
          emailId: "email-1",
          integrationId: "integration-1",
          dispatchId: "dispatch-1",
          organizationName: "Acme",
          message: "Integration dispatch failed",
          metadataJson: JSON.stringify({
            provider: "telegram",
            token: "[redacted]",
          }),
          createdAt: new Date("2026-04-27T11:00:00.000Z"),
        },
      ],
      totalItems: 1,
    });

    const result = await getAdminOperationalEvents({
      env: {} as CloudflareBindings,
      pageRaw: 1,
      pageSizeRaw: 20,
      severity: "error",
      type: "integration_dispatch_failed",
      organizationId: "org-1",
      fromRaw: "2026-04-27T00:00:00.000Z",
      toRaw: "2026-04-28T00:00:00.000Z",
    });

    expect(mocks.findAdminOperationalEventsPage).toHaveBeenCalledWith(
      {},
      { page: 1, pageSize: 20 },
      {
        severity: "error",
        type: "integration_dispatch_failed",
        organizationId: "org-1",
        from: new Date("2026-04-27T00:00:00.000Z"),
        to: new Date("2026-04-28T00:00:00.000Z"),
      }
    );
    expect(result.items).toEqual([
      {
        id: "event-1",
        severity: "error",
        type: "integration_dispatch_failed",
        organizationId: "org-1",
        addressId: null,
        emailId: "email-1",
        integrationId: "integration-1",
        dispatchId: "dispatch-1",
        organizationName: "Acme",
        message: "Integration dispatch failed",
        metadata: {
          provider: "telegram",
          token: "[redacted]",
        },
        createdAt: "2026-04-27T11:00:00.000Z",
      },
    ]);
  });

  it("allows admins to set user roles and records the audit event", async () => {
    const db = createAdminActionDb();
    mocks.getDb.mockReturnValue(db.db);

    await expect(
      performAdminUserAction({
        env: {} as CloudflareBindings,
        actorUserId: "actor-user",
        actorEmail: "actor@example.com",
        actorRole: "admin",
        input: {
          action: "set-role",
          userId: "target-user",
          role: "admin",
        },
      })
    ).resolves.toEqual({ ok: true });

    expect(db.set).toHaveBeenCalledWith({
      role: "admin",
      updatedAt: new Date("2026-04-27T12:00:00.000Z"),
    });
    expect(db.insertValues).toHaveBeenCalled();
  });

  it("rejects admin actions from non-admin users", async () => {
    const db = createAdminActionDb();
    mocks.getDb.mockReturnValue(db.db);

    await expect(
      performAdminUserAction({
        env: {} as CloudflareBindings,
        actorUserId: "actor-user",
        actorEmail: "actor@example.com",
        actorRole: "user",
        input: {
          action: "ban",
          userId: "target-user",
          reason: "Policy violation",
        },
      })
    ).rejects.toThrow("forbidden");

    expect(db.updateWhere).not.toHaveBeenCalled();
    expect(db.insertValues).not.toHaveBeenCalled();
  });
});
