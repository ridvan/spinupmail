const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

import {
  pruneOperationalEvents,
  recordOperationalEvent,
  recordOperationalEventSafely,
} from "@/modules/admin/operational-events";

describe("admin operational events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts sensitive metadata before writing operational events", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values }));
    mocks.getDb.mockReturnValue({ insert });

    await recordOperationalEvent({
      env: {} as CloudflareBindings,
      severity: "error",
      type: "inbound_storage_failed",
      organizationId: "org-1",
      addressId: "address-1",
      emailId: "email-1",
      message: "Storage persistence failed",
      metadata: {
        provider: "r2",
        token: "secret-token",
        nested: {
          authorization: "Bearer value",
          retryCount: 2,
        },
        rawHeaders: {
          subject: "private",
        },
        context: {
          id: "ctx-1",
        },
      },
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "error",
        type: "inbound_storage_failed",
        organizationId: "org-1",
        addressId: "address-1",
        emailId: "email-1",
        message: "Storage persistence failed",
        metadataJson: JSON.stringify({
          provider: "r2",
          token: "[redacted]",
          nested: {
            authorization: "[redacted]",
            retryCount: 2,
          },
          rawHeaders: "[redacted]",
          context: {
            id: "ctx-1",
          },
        }),
      })
    );
  });

  it("does not throw when safe event recording fails", async () => {
    const error = new Error("d1 unavailable");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const values = vi.fn().mockRejectedValue(error);
    const insert = vi.fn(() => ({ values }));
    mocks.getDb.mockReturnValue({ insert });

    await expect(
      recordOperationalEventSafely({
        env: {} as CloudflareBindings,
        severity: "warning",
        type: "system_error",
        message: "Rejected",
      })
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      "[admin] Failed to record operational event",
      {
        type: "system_error",
        severity: "warning",
        error,
      }
    );
  });

  it("caps message and metadata size before writing operational events", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values }));
    mocks.getDb.mockReturnValue({ insert });

    await recordOperationalEvent({
      env: {
        OPERATIONAL_EVENT_MAX_METADATA_BYTES: "1024",
      } as CloudflareBindings,
      severity: "error",
      type: "system_error",
      message: "x".repeat(2_000),
      metadata: {
        reason: "large_payload",
        ...Object.fromEntries(
          Array.from({ length: 60 }, (_, index) => [
            `detail${index}`,
            "y".repeat(2_000),
          ])
        ),
      },
    });

    const written = values.mock.calls[0]?.[0] as {
      message: string;
      metadataJson: string;
    };
    expect(written.message).toHaveLength(500);
    expect(written.message).toContain("[truncated]");
    expect(written.metadataJson.length).toBeLessThanOrEqual(1024);
    expect(JSON.parse(written.metadataJson)).toMatchObject({
      truncated: true,
    });
  });

  it("suppresses noisy operational events when the event limiter is exhausted", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values }));
    const consume = vi.fn().mockResolvedValue({ allowed: false });
    mocks.getDb.mockReturnValue({ insert });

    await recordOperationalEvent({
      env: {
        FIXED_WINDOW_RATE_LIMITERS: {
          idFromName: vi.fn(value => value),
          get: vi.fn(() => ({ consume })),
        },
      } as unknown as CloudflareBindings,
      severity: "info",
      type: "inbound_rejected",
      message: "Inbound email rejected because the address is not registered",
      metadata: { reason: "address_not_registered" },
    });

    expect(consume).toHaveBeenCalledWith(300, 1);
    expect(insert).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
  });

  it("prunes operational events older than the retention window", async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    mocks.getDb.mockReturnValue({ run });

    await pruneOperationalEvents({
      OPERATIONAL_EVENT_RETENTION_DAYS: "7",
    } as CloudflareBindings);

    expect(run).toHaveBeenCalledOnce();
  });
});
