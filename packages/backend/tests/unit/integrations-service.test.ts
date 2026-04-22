import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@cloudflare/workers-types";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getOrganizationMemberRole: vi.fn(),
  countIntegrationsByOrganization: vi.fn(),
  findIntegrationByIdAndOrganization: vi.fn(),
  buildInsertIntegrationStatement: vi.fn(),
  buildInsertIntegrationSecretStatement: vi.fn(),
  encryptSecret: vi.fn(),
  validateConnection: vi.fn(),
  sendSavedNotification: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/modules/organizations/access", () => ({
  getOrganizationMemberRole: mocks.getOrganizationMemberRole,
  isOrganizationAdminRole: (role: string | null | undefined) =>
    role === "owner" || role === "admin",
}));

vi.mock("@/modules/integrations/repo", () => ({
  countIntegrationsByOrganization: mocks.countIntegrationsByOrganization,
  findIntegrationByIdAndOrganization: mocks.findIntegrationByIdAndOrganization,
  buildInsertIntegrationStatement: mocks.buildInsertIntegrationStatement,
  buildInsertIntegrationSecretStatement:
    mocks.buildInsertIntegrationSecretStatement,
  countDispatchesByIntegrationAndOrganization: vi.fn(),
  countEnabledSubscriptionsForIntegration: vi.fn(),
  deleteIntegrationByIdAndOrganization: vi.fn(),
  findActiveIntegrationSecret: vi.fn(),
  findDispatchById: vi.fn(),
  findDispatchByIdIntegrationAndOrganization: vi.fn(),
  findEmailReceivedSourceById: vi.fn(),
  findIntegrationsByIdsAndOrganization: vi.fn(),
  insertDeliveryAttempt: vi.fn(),
  insertIntegrationDispatch: vi.fn(),
  listAddressSubscriptionsByAddressIds: vi.fn(),
  listDispatchesByIntegrationAndOrganization: vi.fn(),
  listEnabledSubscriptionsForAddressAndEvent: vi.fn(),
  listIntegrationsByOrganization: vi.fn(),
  markDispatchFailed: vi.fn(),
  markDispatchPendingForReplay: vi.fn(),
  markDispatchProcessing: vi.fn(),
  markDispatchRetryScheduled: vi.fn(),
  markDispatchSent: vi.fn(),
  restoreDispatchAfterReplayEnqueueFailure: vi.fn(),
  buildDeleteAddressSubscriptionsByAddressAndEventTypeStatement: vi.fn(),
  buildInsertAddressSubscriptionsStatements: vi.fn(),
}));

vi.mock("@/shared/utils/encryption", () => ({
  encryptSecret: mocks.encryptSecret,
  decryptSecret: vi.fn(),
}));

vi.mock("@/modules/integrations/registry", () => ({
  getIntegrationAdapter: () => ({
    validateConnection: mocks.validateConnection,
    sendSavedNotification: mocks.sendSavedNotification,
    deliver: vi.fn(),
    classifyFailure: vi.fn(),
    supportsEventType: () => true,
  }),
}));

import { createIntegration } from "@/modules/integrations/service";

const session = {
  session: { id: "session-1", userId: "user-1" },
  user: { id: "user-1", emailVerified: true },
} as const;

let batchMock: ReturnType<typeof vi.fn>;

describe("integrations service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    batchMock = vi.fn().mockResolvedValue([{}, {}]);
    mocks.getDb.mockReturnValue({
      $client: {
        batch: batchMock,
      },
    });
    mocks.getOrganizationMemberRole.mockResolvedValue("admin");
    mocks.countIntegrationsByOrganization.mockResolvedValue({ count: 0 });
    mocks.validateConnection.mockResolvedValue({
      provider: "telegram",
      name: "Ops bot",
      publicConfig: {
        telegramBotId: "101",
        botUsername: "spinupmail_bot",
        chatId: "-100123",
        chatLabel: "Ops Room",
      },
      secretConfig: {
        botToken: "123456:ABCdefGhIJKlmNoPQRsTuvWXyz_123456789",
      },
    });
    mocks.sendSavedNotification.mockResolvedValue(undefined);
    mocks.encryptSecret.mockResolvedValue("encrypted-config");
    mocks.buildInsertIntegrationStatement.mockReturnValue("insert-integration");
    mocks.buildInsertIntegrationSecretStatement.mockReturnValue(
      "insert-integration-secret"
    );
    mocks.findIntegrationByIdAndOrganization.mockResolvedValue({
      id: "integration-1",
      organizationId: "org-1",
      provider: "telegram",
      name: "Ops bot",
      status: "active",
      createdByUserId: "user-1",
      publicConfigJson: JSON.stringify({
        telegramBotId: "101",
        botUsername: "spinupmail_bot",
        chatId: "-100123",
        chatLabel: "Ops Room",
      }),
      activeSecretVersion: 1,
      lastValidatedAt: new Date("2026-04-21T10:00:00.000Z"),
      createdAt: new Date("2026-04-21T10:00:00.000Z"),
      updatedAt: new Date("2026-04-21T10:00:00.000Z"),
    });
  });

  it("creates the integration row and secret row in one D1 batch", async () => {
    const result = await createIntegration({
      env: {
        INTEGRATION_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          "base64"
        ),
      } as CloudflareBindings,
      organizationId: "org-1",
      session,
      payload: {
        provider: "telegram",
        name: "Ops bot",
        config: {
          botToken: "123456:ABCdefGhIJKlmNoPQRsTuvWXyz_123456789",
          chatId: "-100123",
        },
      },
    });

    expect(mocks.buildInsertIntegrationStatement).toHaveBeenCalledTimes(1);
    expect(mocks.buildInsertIntegrationSecretStatement).toHaveBeenCalledTimes(
      1
    );
    expect(batchMock).toHaveBeenCalledWith([
      "insert-integration",
      "insert-integration-secret",
    ]);
    expect(mocks.validateConnection).toHaveBeenCalledWith(
      {
        provider: "telegram",
        name: "Ops bot",
        config: {
          botToken: "123456:ABCdefGhIJKlmNoPQRsTuvWXyz_123456789",
          chatId: "-100123",
        },
      },
      { reason: "create" }
    );
    expect(mocks.sendSavedNotification).toHaveBeenCalledWith({
      name: "Ops bot",
      publicConfig: {
        telegramBotId: "101",
        botUsername: "spinupmail_bot",
        chatId: "-100123",
        chatLabel: "Ops Room",
      },
      secretConfig: {
        botToken: "123456:ABCdefGhIJKlmNoPQRsTuvWXyz_123456789",
      },
    });
    expect(result.status).toBe(201);
  });

  it("returns success even when saved notification fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.sendSavedNotification.mockRejectedValueOnce(
      new Error("telegram notify failed")
    );

    const result = await createIntegration({
      env: {
        INTEGRATION_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          "base64"
        ),
      } as CloudflareBindings,
      organizationId: "org-1",
      session,
      payload: {
        provider: "telegram",
        name: "Ops bot",
        config: {
          botToken: "123456:ABCdefGhIJKlmNoPQRsTuvWXyz_123456789",
          chatId: "-100123",
        },
      },
    });

    expect(result.status).toBe(201);
    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalledWith(
      "[integrations] Failed to send post-save notification",
      expect.objectContaining({
        organizationId: "org-1",
        provider: "telegram",
        integrationName: "Ops bot",
        error: "telegram notify failed",
      })
    );
    warnSpy.mockRestore();
  });

  it("schedules saved notification using execution context", async () => {
    let resolveNotification: (() => void) | null = null;
    mocks.sendSavedNotification.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveNotification = resolve;
        })
    );

    const waitUntil = vi.fn();
    const result = await Promise.race([
      createIntegration({
        env: {
          INTEGRATION_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
            "base64"
          ),
        } as CloudflareBindings,
        organizationId: "org-1",
        session,
        payload: {
          provider: "telegram",
          name: "Ops bot",
          config: {
            botToken: "123456:ABCdefGhIJKlmNoPQRsTuvWXyz_123456789",
            chatId: "-100123",
          },
        },
        executionContext: {
          waitUntil,
          passThroughOnException: vi.fn(),
        } as unknown as ExecutionContext,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("createIntegration timed out")), 50);
      }),
    ]);

    expect(result.status).toBe(201);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    resolveNotification?.();
  });
});
