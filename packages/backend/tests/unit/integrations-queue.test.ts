import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  completeDeliveryAttempt: vi.fn(),
  deleteDeliveryAttemptById: vi.fn(),
  findDispatchById: vi.fn(),
  findIntegrationByIdAndOrganization: vi.fn(),
  findActiveIntegrationSecret: vi.fn(),
  findOldestDeliveryAttemptStartedAtByOrganizationSince: vi.fn(),
  markDispatchFailed: vi.fn(),
  markDispatchProcessing: vi.fn(),
  markDispatchRetryScheduled: vi.fn(),
  markDispatchSent: vi.fn(),
  reserveDeliveryAttemptIfUnderOrganizationDailyLimit: vi.fn(),
  decryptSecret: vi.fn(),
  deliver: vi.fn(),
  classifyFailure: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/modules/integrations/repo", () => ({
  completeDeliveryAttempt: mocks.completeDeliveryAttempt,
  deleteDeliveryAttemptById: mocks.deleteDeliveryAttemptById,
  findDispatchById: mocks.findDispatchById,
  findIntegrationByIdAndOrganization: mocks.findIntegrationByIdAndOrganization,
  findActiveIntegrationSecret: mocks.findActiveIntegrationSecret,
  findOldestDeliveryAttemptStartedAtByOrganizationSince:
    mocks.findOldestDeliveryAttemptStartedAtByOrganizationSince,
  markDispatchFailed: mocks.markDispatchFailed,
  markDispatchProcessing: mocks.markDispatchProcessing,
  markDispatchRetryScheduled: mocks.markDispatchRetryScheduled,
  markDispatchSent: mocks.markDispatchSent,
  reserveDeliveryAttemptIfUnderOrganizationDailyLimit:
    mocks.reserveDeliveryAttemptIfUnderOrganizationDailyLimit,
}));

vi.mock("@/shared/utils/encryption", () => ({
  decryptSecret: mocks.decryptSecret,
  encryptSecret: vi.fn(),
}));

vi.mock("@/modules/integrations/registry", () => ({
  getIntegrationAdapter: () => ({
    deliver: mocks.deliver,
    classifyFailure: mocks.classifyFailure,
    validateConnection: vi.fn(),
    supportsEventType: () => true,
  }),
}));

import { handleIntegrationDispatchQueueBatch } from "@/modules/integrations/queue";

const buildMessage = (overrides?: Partial<Message>) => {
  const ack = vi.fn();
  const retry = vi.fn();

  const message = {
    id: "queue-message-1",
    timestamp: new Date("2026-04-19T12:00:00.000Z"),
    attempts: 1,
    body: {
      dispatchId: "dispatch-1",
    },
    ack,
    retry,
    ...overrides,
  } as Message;

  return { message, ack, retry };
};

const buildBatch = (message: Message): MessageBatch => ({
  queue: "spinupmail-integration-dispatches",
  messages: [message],
  metadata: {
    metrics: {
      backlogCount: 1,
      backlogBytes: 0,
    },
  },
  ackAll: vi.fn(),
  retryAll: vi.fn(),
});

describe("integration dispatch queue handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));
    mocks.getDb.mockReturnValue({});
    mocks.findDispatchById.mockResolvedValue({
      id: "dispatch-1",
      organizationId: "org-1",
      integrationId: "integration-1",
      status: "pending",
      attemptCount: 0,
      maxAttemptWindowMs: 21600000,
      createdAt: new Date(),
      payloadJson: JSON.stringify({
        eventId: "event-1",
        eventType: "email.received",
        occurredAt: "2026-04-19T10:00:00.000Z",
        organizationId: "org-1",
        addressId: "address-1",
        address: "demo@spinupmail.com",
        emailId: "email-1",
        messageId: "message-1",
        from: "sender@example.com",
        senderLabel: "Sender",
        subject: "Hello",
        preview: "Hello world",
        attachmentCount: 0,
      }),
    });
    mocks.findIntegrationByIdAndOrganization.mockResolvedValue({
      id: "integration-1",
      organizationId: "org-1",
      provider: "telegram",
      activeSecretVersion: 1,
      publicConfigJson: JSON.stringify({
        telegramBotId: "101",
        botUsername: "spinupmail_bot",
        chatId: "-100123",
        chatLabel: "Ops Room",
      }),
    });
    mocks.findActiveIntegrationSecret.mockResolvedValue({
      integrationId: "integration-1",
      version: 1,
      encryptedConfigJson: "ciphertext",
    });
    mocks.decryptSecret.mockResolvedValue(
      JSON.stringify({
        botToken: "123456:ABCdefGhIJKlmNoPQRsTuvWXyz_123456789",
      })
    );
    mocks.markDispatchProcessing.mockResolvedValue(true);
    mocks.markDispatchSent.mockResolvedValue(undefined);
    mocks.markDispatchRetryScheduled.mockResolvedValue(undefined);
    mocks.markDispatchFailed.mockResolvedValue(undefined);
    mocks.completeDeliveryAttempt.mockResolvedValue(undefined);
    mocks.deleteDeliveryAttemptById.mockResolvedValue(undefined);
    mocks.findOldestDeliveryAttemptStartedAtByOrganizationSince.mockResolvedValue(
      {
        startedAt: new Date("2026-04-18T12:30:00.000Z"),
      }
    );
    mocks.reserveDeliveryAttemptIfUnderOrganizationDailyLimit.mockResolvedValue(
      true
    );
    mocks.deliver.mockResolvedValue(undefined);
    mocks.classifyFailure.mockReturnValue({
      code: "telegram_rate_limited",
      message: "Too Many Requests",
      status: 429,
      retryAfterSeconds: 30,
      retryable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("acks invalid payload messages", async () => {
    const { message, ack, retry } = buildMessage({
      body: { bad: true } as never,
    });

    await handleIntegrationDispatchQueueBatch({
      batch: buildBatch(message),
      env: {} as CloudflareBindings,
    });

    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it("marks dispatches sent and acks on successful delivery", async () => {
    const { message, ack, retry } = buildMessage();

    await handleIntegrationDispatchQueueBatch({
      batch: buildBatch(message),
      env: {
        INTEGRATION_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          "base64"
        ),
      } as CloudflareBindings,
    });

    expect(mocks.markDispatchProcessing).toHaveBeenCalledWith({
      db: {},
      id: "dispatch-1",
      attemptCount: 1,
      queueMessageId: "queue-message-1",
    });
    expect(
      mocks.reserveDeliveryAttemptIfUnderOrganizationDailyLimit
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        db: {},
        maxAttempts: 100,
        values: expect.objectContaining({
          dispatchId: "dispatch-1",
          outcome: "processing",
        }),
      })
    );
    expect(mocks.deliver).toHaveBeenCalled();
    expect(mocks.completeDeliveryAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        db: {},
        outcome: "sent",
      })
    );
    expect(mocks.markDispatchSent).toHaveBeenCalledWith({
      db: {},
      id: "dispatch-1",
    });
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it("acks without delivering when another worker already claimed the dispatch", async () => {
    const { message, ack, retry } = buildMessage();
    mocks.markDispatchProcessing.mockResolvedValueOnce(false);

    await handleIntegrationDispatchQueueBatch({
      batch: buildBatch(message),
      env: {
        INTEGRATION_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          "base64"
        ),
      } as CloudflareBindings,
    });

    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.markDispatchSent).not.toHaveBeenCalled();
    expect(mocks.deleteDeliveryAttemptById).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it("keeps dispatches scheduled when the organization daily limit is reached", async () => {
    const { message, ack, retry } = buildMessage();
    mocks.reserveDeliveryAttemptIfUnderOrganizationDailyLimit.mockResolvedValueOnce(
      false
    );

    await handleIntegrationDispatchQueueBatch({
      batch: buildBatch(message),
      env: {
        INTEGRATION_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          "base64"
        ),
      } as CloudflareBindings,
    });

    expect(mocks.markDispatchProcessing).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.markDispatchRetryScheduled).toHaveBeenCalledWith(
      expect.objectContaining({
        db: {},
        id: "dispatch-1",
        lastError: "Organization reached the daily integration dispatch limit",
        lastErrorCode: "organization_daily_dispatch_limit_reached",
        nextAttemptAt: new Date("2026-04-19T12:30:01.000Z"),
      })
    );
    expect(retry).toHaveBeenCalledWith({ delaySeconds: 1801 });
    expect(ack).not.toHaveBeenCalled();
  });

  it("schedules retry for retryable failures", async () => {
    const { message, ack, retry } = buildMessage();
    mocks.deliver.mockRejectedValueOnce(new Error("rate limited"));

    await handleIntegrationDispatchQueueBatch({
      batch: buildBatch(message),
      env: {
        INTEGRATION_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          "base64"
        ),
        INTEGRATION_QUEUE_BASE_DELAY_SECONDS: "900",
        INTEGRATION_QUEUE_MAX_DELAY_SECONDS: "900",
        INTEGRATION_QUEUE_JITTER_SECONDS: "0",
      } as CloudflareBindings,
    });

    expect(mocks.markDispatchRetryScheduled).toHaveBeenCalled();
    expect(mocks.completeDeliveryAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        db: {},
        outcome: "failed",
        error: "Too Many Requests",
        errorCode: "telegram_rate_limited",
      })
    );
    expect(retry).toHaveBeenCalledWith({ delaySeconds: 900 });
    expect(ack).not.toHaveBeenCalled();
  });

  it("acks and marks permanent failure for non-retryable errors", async () => {
    const { message, ack, retry } = buildMessage();
    mocks.deliver.mockRejectedValueOnce(new Error("bad request"));
    mocks.classifyFailure.mockReturnValueOnce({
      code: "telegram_bad_request",
      message: "Bad Request",
      status: 400,
      retryAfterSeconds: null,
      retryable: false,
    });

    await handleIntegrationDispatchQueueBatch({
      batch: buildBatch(message),
      env: {
        INTEGRATION_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          "base64"
        ),
      } as CloudflareBindings,
    });

    expect(mocks.markDispatchFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        db: {},
        id: "dispatch-1",
        status: "failed_permanent",
        lastError: "Bad Request",
        lastErrorCode: "telegram_bad_request",
        lastErrorStatus: 400,
      })
    );
    expect(mocks.completeDeliveryAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        db: {},
        outcome: "failed",
        error: "Bad Request",
        errorCode: "telegram_bad_request",
      })
    );
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it("acks and marks permanent failure when stored integration config is invalid", async () => {
    const { message, ack, retry } = buildMessage();
    mocks.findIntegrationByIdAndOrganization.mockResolvedValueOnce({
      id: "integration-1",
      organizationId: "org-1",
      provider: "telegram",
      activeSecretVersion: 1,
      publicConfigJson: "{bad json",
    });

    await handleIntegrationDispatchQueueBatch({
      batch: buildBatch(message),
      env: {
        INTEGRATION_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString(
          "base64"
        ),
      } as CloudflareBindings,
    });

    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.completeDeliveryAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        db: {},
        outcome: "failed",
        error: "Stored integration public config is invalid",
        errorCode: "integration_public_config_invalid",
      })
    );
    expect(mocks.markDispatchFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        db: {},
        id: "dispatch-1",
        status: "failed_permanent",
        lastError: "Stored integration public config is invalid",
        lastErrorCode: "integration_public_config_invalid",
      })
    );
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });
});
