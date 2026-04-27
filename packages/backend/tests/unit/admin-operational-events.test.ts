const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

import {
  recordOperationalEvent,
  recordOperationalEventSafely,
} from "@/modules/admin/operational-events";

describe("admin operational events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        type: "inbound_rejected",
        message: "Rejected",
      })
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      "[admin] Failed to record operational event",
      {
        type: "inbound_rejected",
        severity: "warning",
        error,
      }
    );
  });
});
