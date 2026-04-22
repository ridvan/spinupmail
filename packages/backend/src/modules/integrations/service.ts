import {
  createIntegrationRequestSchema,
  deleteIntegrationResponseSchema,
  listIntegrationDispatchesParamsSchema,
  telegramIntegrationPublicConfigSchema,
  type AddressIntegration,
  type CreateIntegrationRequest,
  type IntegrationSubscription,
  type OrganizationIntegrationSummary,
  type ValidateIntegrationConnectionRequest,
  validateIntegrationConnectionRequestSchema,
} from "@spinupmail/contracts";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { getDb } from "@/platform/db/client";
import type { AppDb } from "@/platform/db/client";
import {
  getOrganizationMemberRole,
  isOrganizationAdminRole,
} from "@/modules/organizations/access";
import {
  getMaxIntegrationDispatchesPerOrganizationPerDay,
  getMaxIntegrationsPerOrganization,
  getIntegrationQueueRetryConfig,
  getIntegrationSecretEncryptionKey,
} from "@/shared/env";
import { hashForRateLimitKey } from "@/shared/utils/crypto";
import { decryptSecret, encryptSecret } from "@/shared/utils/encryption";
import type { AppHonoEnv } from "@/app/types";
import { getIntegrationAdapter } from "./registry";
import {
  EMAIL_RECEIVED_EVENT_TYPE,
  type EmailReceivedPayload,
  type IntegrationDispatchQueueMessage,
  type IntegrationDispatchStatus,
  type IntegrationEventType,
  type IntegrationProvider,
} from "./types";
import {
  buildDeleteAddressSubscriptionsByAddressAndEventTypeStatement,
  buildInsertAddressSubscriptionsStatements,
  buildInsertIntegrationSecretStatement,
  buildInsertIntegrationStatement,
  completeDeliveryAttempt,
  countIntegrationsByOrganization,
  countDispatchesByIntegrationAndOrganization,
  deleteDeliveryAttemptById,
  countEnabledSubscriptionsForIntegration,
  deleteIntegrationByIdAndOrganization,
  findActiveIntegrationSecret,
  findDispatchById,
  findDispatchByIdIntegrationAndOrganization,
  findOldestDeliveryAttemptStartedAtByOrganizationSince,
  findEmailReceivedSourceById,
  findIntegrationByIdAndOrganization,
  findIntegrationsByIdsAndOrganization,
  insertIntegrationDispatch,
  listAddressSubscriptionsByAddressIds,
  listDispatchesByIntegrationAndOrganization,
  listEnabledSubscriptionsForAddressAndEvent,
  listIntegrationsByOrganization,
  markDispatchFailed,
  markDispatchPendingForReplay,
  markDispatchProcessing,
  markDispatchRetryScheduled,
  markDispatchSent,
  reserveDeliveryAttemptIfUnderOrganizationDailyLimit,
  restoreDispatchAfterReplayEnqueueFailure,
} from "./repo";

const INTEGRATION_DISPATCH_PAGE_DEFAULT = 1;
const INTEGRATION_DISPATCH_PAGE_SIZE_DEFAULT = 5;
const INTEGRATION_DISPATCH_PAGE_SIZE_MAX = 100;
const INTEGRATION_DAILY_DISPATCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const TERMINAL_STATUSES = new Set<IntegrationDispatchStatus>([
  "sent",
  "failed_permanent",
  "failed_dlq",
]);

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Error && /unique constraint failed/i.test(error.message);

const parseCreateIntegrationBody = (
  payload: unknown
): CreateIntegrationRequest | null => {
  const parsed = createIntegrationRequestSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
};

const parseValidateIntegrationBody = (
  payload: unknown
): ValidateIntegrationConnectionRequest | null => {
  const parsed = validateIntegrationConnectionRequestSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
};

const parseListDispatchesQuery = (payload: unknown) => {
  const source =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const parsed = listIntegrationDispatchesParamsSchema.safeParse({
    ...source,
    page: typeof source.page === "string" ? Number(source.page) : source.page,
    pageSize:
      typeof source.pageSize === "string"
        ? Number(source.pageSize)
        : source.pageSize,
  });
  if (!parsed.success) return {};
  return parsed.data;
};

const clampInteger = (
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
) => {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(value as number);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
};

const getCryptoRandomInt = (upperBoundExclusive: number) => {
  if (!Number.isSafeInteger(upperBoundExclusive) || upperBoundExclusive <= 0) {
    throw new Error("upperBoundExclusive must be a positive safe integer");
  }

  if (upperBoundExclusive === 1) return 0;

  const upperBound = BigInt(upperBoundExclusive);
  const bitLength = Math.ceil(Math.log2(upperBoundExclusive));
  const byteLength = Math.ceil(bitLength / 8);
  const leadingBitMask = 0xff >>> (byteLength * 8 - bitLength);

  while (true) {
    const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
    bytes[0] = bytes[0]! & leadingBitMask;

    let candidate = 0n;
    for (const byte of bytes) {
      candidate = (candidate << 8n) | BigInt(byte);
    }

    if (candidate < upperBound) {
      return Number(candidate);
    }
  }
};

const requireOrganizationAdmin = async ({
  env,
  organizationId,
  session,
}: {
  env: CloudflareBindings;
  organizationId: string;
  session: AppHonoEnv["Variables"]["session"];
}) => {
  const db = getDb(env);
  const role = await getOrganizationMemberRole({
    db,
    organizationId,
    userId: session.user.id,
  });

  if (!isOrganizationAdminRole(role)) {
    return {
      ok: false as const,
      response: {
        status: 403 as const,
        body: { error: "forbidden" },
      },
    };
  }

  return { ok: true as const, db };
};

const parseTelegramPublicConfig = (value: string) => {
  const parsed = telegramIntegrationPublicConfigSchema.safeParse(
    JSON.parse(value)
  );
  if (!parsed.success) {
    throw new Error("Stored telegram integration config is invalid");
  }
  return parsed.data;
};

const formatIntegrationSummary = (
  row: Awaited<ReturnType<typeof listIntegrationsByOrganization>>[number]
): OrganizationIntegrationSummary => {
  if (row.provider !== "telegram") {
    throw new Error(`Unsupported integration provider: ${row.provider}`);
  }

  return {
    id: row.id,
    provider: "telegram",
    name: row.name,
    status: row.status as "active" | "archived",
    supportedEventTypes: [EMAIL_RECEIVED_EVENT_TYPE],
    mailboxCount: Number(row.mailboxCount ?? 0),
    publicConfig: parseTelegramPublicConfig(row.publicConfigJson),
    lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
    lastValidatedAtMs: row.lastValidatedAt?.getTime() ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
    createdAtMs: row.createdAt?.getTime() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    updatedAtMs: row.updatedAt?.getTime() ?? null,
  };
};

const buildAddressIntegrationMap = (
  rows: Awaited<ReturnType<typeof listAddressSubscriptionsByAddressIds>>
) => {
  const map = new Map<string, AddressIntegration[]>();

  for (const row of rows) {
    if (!row.enabled || row.integrationStatus !== "active") continue;

    const existing = map.get(row.addressId) ?? [];
    existing.push({
      id: row.integrationId,
      provider: row.integrationProvider as IntegrationProvider,
      name: row.integrationName,
      eventType: row.eventType as IntegrationEventType,
    });
    map.set(row.addressId, existing);
  }

  for (const item of map.values()) {
    item.sort((a, b) => a.name.localeCompare(b.name));
  }

  return map;
};

const uniqueIntegrationSubscriptions = (
  subscriptions: IntegrationSubscription[] | undefined
) => {
  const seen = new Set<string>();
  const unique: IntegrationSubscription[] = [];

  for (const subscription of subscriptions ?? []) {
    const key = `${subscription.integrationId}:${subscription.eventType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(subscription);
  }

  return unique;
};

const buildPreview = (value: string | null | undefined) => {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return "No preview available.";
  if (normalized.length <= 280) return normalized;
  return `${normalized.slice(0, 279).trimEnd()}…`;
};

const parseDispatchPayload = (value: string): EmailReceivedPayload => {
  return JSON.parse(value) as EmailReceivedPayload;
};

class IntegrationDispatchPreparationError extends Error {
  code: string;

  constructor(message: string, code: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "IntegrationDispatchPreparationError";
    this.code = code;
  }
}

const classifyIntegrationDispatchFailure = ({
  adapter,
  error,
}: {
  adapter: ReturnType<typeof getIntegrationAdapter>;
  error: unknown;
}) => {
  if (error instanceof IntegrationDispatchPreparationError) {
    return {
      code: error.code,
      message: error.message,
      status: null,
      retryAfterSeconds: null,
      retryable: false,
    };
  }

  return adapter.classifyFailure(error);
};

const buildRetryDelaySeconds = (
  attemptCount: number,
  env: CloudflareBindings
) => {
  const config = getIntegrationQueueRetryConfig(env);
  const baseDelaySeconds = Math.max(1, config.baseDelaySeconds);
  const exponentialDelaySeconds = Math.min(
    config.maxDelaySeconds,
    baseDelaySeconds * 2 ** Math.max(0, attemptCount - 1)
  );
  const jitterSeconds =
    config.jitterSeconds > 0 ? getCryptoRandomInt(config.jitterSeconds + 1) : 0;

  return Math.min(
    config.maxDelaySeconds,
    exponentialDelaySeconds + jitterSeconds
  );
};

const buildDailyDispatchLimitDelaySeconds = ({
  now,
  oldestStartedAt,
}: {
  now: Date;
  oldestStartedAt: Date | null | undefined;
}) => {
  if (!oldestStartedAt) return 60;

  const retryAtMs =
    oldestStartedAt.getTime() + INTEGRATION_DAILY_DISPATCH_WINDOW_MS + 1000;

  return Math.max(1, Math.ceil((retryAtMs - now.getTime()) / 1000));
};

const hasExceededRetryWindow = ({
  createdAt,
  maxAttemptWindowMs,
  now,
}: {
  createdAt: Date;
  maxAttemptWindowMs: number;
  now: Date;
}) => now.getTime() - createdAt.getTime() >= maxAttemptWindowMs;

const parseQueueMessage = (
  value: unknown
): IntegrationDispatchQueueMessage | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  return typeof record.dispatchId === "string"
    ? { dispatchId: record.dispatchId }
    : null;
};

export const getAddressIntegrationsByAddressIds = async ({
  db,
  organizationId,
  addressIds,
}: {
  db: AppDb;
  organizationId: string;
  addressIds: string[];
}) => {
  const rows = await listAddressSubscriptionsByAddressIds({
    db,
    organizationId,
    addressIds,
  });

  return buildAddressIntegrationMap(rows);
};

export const syncAddressIntegrationSubscriptions = async ({
  db,
  organizationId,
  addressId,
  subscriptions,
}: {
  db: AppDb;
  organizationId: string;
  addressId: string;
  subscriptions: IntegrationSubscription[];
}) => {
  const nextSubscriptions = uniqueIntegrationSubscriptions(subscriptions);
  const values = nextSubscriptions.map(subscription => ({
    id: crypto.randomUUID(),
    organizationId,
    addressId,
    integrationId: subscription.integrationId,
    eventType: subscription.eventType,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  await db.$client.batch([
    buildDeleteAddressSubscriptionsByAddressAndEventTypeStatement({
      db,
      organizationId,
      addressId,
      eventType: EMAIL_RECEIVED_EVENT_TYPE,
    }),
    ...buildInsertAddressSubscriptionsStatements({
      db,
      values,
    }),
  ]);
};

export const validateAddressIntegrationSubscriptions = async ({
  env,
  organizationId,
  session,
  subscriptions,
}: {
  env: CloudflareBindings;
  organizationId: string;
  session: AppHonoEnv["Variables"]["session"];
  subscriptions: IntegrationSubscription[] | undefined;
}) => {
  if (subscriptions === undefined) {
    return { ok: true as const, subscriptions: undefined };
  }

  const adminCheck = await requireOrganizationAdmin({
    env,
    organizationId,
    session,
  });
  if (!adminCheck.ok) {
    return {
      ok: false as const,
      response: {
        status: 403 as const,
        body: {
          error: "Only organization admins can manage integrations",
        },
      },
    };
  }

  const nextSubscriptions = uniqueIntegrationSubscriptions(subscriptions);
  const integrationIds = nextSubscriptions.map(item => item.integrationId);
  const integrations = await findIntegrationsByIdsAndOrganization({
    db: adminCheck.db,
    ids: integrationIds,
    organizationId,
  });
  const integrationMap = new Map(integrations.map(item => [item.id, item]));

  for (const subscription of nextSubscriptions) {
    if (subscription.eventType !== EMAIL_RECEIVED_EVENT_TYPE) {
      return {
        ok: false as const,
        response: {
          status: 400 as const,
          body: {
            error: `Unsupported integration event type: ${subscription.eventType}`,
          },
        },
      };
    }

    const integration = integrationMap.get(subscription.integrationId);
    if (!integration || integration.status !== "active") {
      return {
        ok: false as const,
        response: {
          status: 400 as const,
          body: {
            error:
              "integrationSubscriptions must reference active integrations in the current organization",
          },
        },
      };
    }

    const adapter = getIntegrationAdapter(
      integration.provider as IntegrationProvider
    );
    if (!adapter.supportsEventType(subscription.eventType)) {
      return {
        ok: false as const,
        response: {
          status: 400 as const,
          body: {
            error: `Integration "${integration.name}" does not support ${subscription.eventType}`,
          },
        },
      };
    }
  }

  return {
    ok: true as const,
    subscriptions: nextSubscriptions,
  };
};

export const listIntegrations = async ({
  env,
  organizationId,
  session,
}: {
  env: CloudflareBindings;
  organizationId: string;
  session: AppHonoEnv["Variables"]["session"];
}) => {
  const adminCheck = await requireOrganizationAdmin({
    env,
    organizationId,
    session,
  });
  if (!adminCheck.ok) return adminCheck.response;

  const items = await listIntegrationsByOrganization({
    db: adminCheck.db,
    organizationId,
  });

  return {
    status: 200 as const,
    body: {
      items: items.map(formatIntegrationSummary),
    },
  };
};

export const validateIntegrationConnection = async ({
  env,
  organizationId,
  session,
  payload,
}: {
  env: CloudflareBindings;
  organizationId: string;
  session: AppHonoEnv["Variables"]["session"];
  payload: unknown;
}) => {
  const adminCheck = await requireOrganizationAdmin({
    env,
    organizationId,
    session,
  });
  if (!adminCheck.ok) return adminCheck.response;

  const body = parseValidateIntegrationBody(payload);
  if (!body) {
    return {
      status: 400 as const,
      body: { error: "invalid integration payload" },
    };
  }

  const adapter = getIntegrationAdapter(body.provider);

  try {
    const result = await adapter.validateConnection(body, {
      reason: "validate",
    });
    return {
      status: 200 as const,
      body: {
        provider: body.provider,
        name: body.name,
        publicConfig: result.publicConfig,
        validationSummary: result.validationSummary,
      },
    };
  } catch (error) {
    const failure = adapter.classifyFailure(error);
    return {
      status:
        failure.status && failure.status >= 400 && failure.status < 500
          ? 400
          : 502,
      body: { error: failure.message },
    };
  }
};

export const createIntegration = async ({
  env,
  organizationId,
  session,
  payload,
  executionContext,
}: {
  env: CloudflareBindings;
  organizationId: string;
  session: AppHonoEnv["Variables"]["session"];
  payload: unknown;
  executionContext?: ExecutionContext;
}) => {
  const adminCheck = await requireOrganizationAdmin({
    env,
    organizationId,
    session,
  });
  if (!adminCheck.ok) return adminCheck.response;

  const body = parseCreateIntegrationBody(payload);
  if (!body) {
    return {
      status: 400 as const,
      body: { error: "invalid integration payload" },
    };
  }

  const integrationCount = await countIntegrationsByOrganization({
    db: adminCheck.db,
    organizationId,
  });
  const maxIntegrationsPerOrganization = getMaxIntegrationsPerOrganization(env);
  if (Number(integrationCount?.count ?? 0) >= maxIntegrationsPerOrganization) {
    return {
      status: 409 as const,
      body: {
        error: `Each organization can have at most ${maxIntegrationsPerOrganization} integrations`,
      },
    };
  }

  const encryptionKey = getIntegrationSecretEncryptionKey(env);
  if (!encryptionKey) {
    return {
      status: 500 as const,
      body: { error: "INTEGRATION_SECRET_ENCRYPTION_KEY is not configured" },
    };
  }

  const adapter = getIntegrationAdapter(body.provider);

  try {
    const validated = await adapter.validateConnection(body, {
      reason: "create",
    });
    const createdId = crypto.randomUUID();
    const publicConfigJson = JSON.stringify(validated.publicConfig);
    const encryptedConfigJson = await encryptSecret({
      plaintext: JSON.stringify(validated.secretConfig),
      encodedKey: encryptionKey,
    });
    const now = new Date();

    await adminCheck.db.$client.batch([
      buildInsertIntegrationStatement({
        db: adminCheck.db,
        values: {
          id: createdId,
          organizationId,
          provider: body.provider,
          name: body.name,
          status: "active",
          createdByUserId: session.user.id,
          publicConfigJson,
          activeSecretVersion: 1,
          lastValidatedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      }),
      buildInsertIntegrationSecretStatement({
        db: adminCheck.db,
        values: {
          integrationId: createdId,
          version: 1,
          encryptedConfigJson,
          createdAt: now,
        },
      }),
    ]);

    const created = await findIntegrationByIdAndOrganization({
      db: adminCheck.db,
      id: createdId,
      organizationId,
    });
    if (!created) {
      throw new Error("Created integration not found");
    }

    if (adapter.sendSavedNotification) {
      const notificationPromise = adapter
        .sendSavedNotification({
          name: body.name,
          publicConfig: validated.publicConfig,
          secretConfig: validated.secretConfig,
        })
        .catch(error => {
          console.warn("[integrations] Failed to send post-save notification", {
            organizationId,
            provider: body.provider,
            integrationName: body.name,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      if (executionContext) {
        executionContext.waitUntil(notificationPromise);
      } else {
        void notificationPromise;
      }
    }

    return {
      status: 201 as const,
      body: {
        ...formatIntegrationSummary({
          ...created,
          mailboxCount: 0,
        }),
        createdByUserId: created.createdByUserId,
        activeSecretVersion: Number(created.activeSecretVersion),
      },
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const message =
        error instanceof Error &&
        /organization_integrations.*name/i.test(error.message)
          ? "Integration name already exists"
          : "This integration is already connected";

      return {
        status: 409 as const,
        body: { error: message },
      };
    }

    const failure = adapter.classifyFailure(error);
    return {
      status:
        failure.status && failure.status >= 400 && failure.status < 500
          ? 400
          : 502,
      body: { error: failure.message },
    };
  }
};

export const deleteIntegration = async ({
  env,
  organizationId,
  session,
  integrationId,
}: {
  env: CloudflareBindings;
  organizationId: string;
  session: AppHonoEnv["Variables"]["session"];
  integrationId: string;
}) => {
  const adminCheck = await requireOrganizationAdmin({
    env,
    organizationId,
    session,
  });
  if (!adminCheck.ok) return adminCheck.response;

  const existing = await findIntegrationByIdAndOrganization({
    db: adminCheck.db,
    id: integrationId,
    organizationId,
  });
  if (!existing) {
    return {
      status: 404 as const,
      body: { error: "integration not found" },
    };
  }

  const subscriptionCount = await countEnabledSubscriptionsForIntegration({
    db: adminCheck.db,
    integrationId,
    organizationId,
  });
  const dispatchCount = await countDispatchesByIntegrationAndOrganization({
    db: adminCheck.db,
    organizationId,
    integrationId,
  });

  await deleteIntegrationByIdAndOrganization({
    db: adminCheck.db,
    id: integrationId,
    organizationId,
  });

  const body = {
    id: existing.id,
    deleted: true as const,
    clearedMailboxCount: Number(subscriptionCount?.count ?? 0),
    deletedDispatchCount: Number(dispatchCount?.count ?? 0),
  };

  deleteIntegrationResponseSchema.parse(body);

  return {
    status: 200 as const,
    body,
  };
};

export const listIntegrationDispatches = async ({
  env,
  organizationId,
  session,
  integrationId,
  queryPayload,
}: {
  env: CloudflareBindings;
  organizationId: string;
  session: AppHonoEnv["Variables"]["session"];
  integrationId: string;
  queryPayload: unknown;
}) => {
  const adminCheck = await requireOrganizationAdmin({
    env,
    organizationId,
    session,
  });
  if (!adminCheck.ok) return adminCheck.response;

  const integration = await findIntegrationByIdAndOrganization({
    db: adminCheck.db,
    id: integrationId,
    organizationId,
  });
  if (!integration) {
    return {
      status: 404 as const,
      body: { error: "integration not found" },
    };
  }

  const query = parseListDispatchesQuery(queryPayload);
  const page = clampInteger(
    query.page,
    1,
    Number.MAX_SAFE_INTEGER,
    INTEGRATION_DISPATCH_PAGE_DEFAULT
  );
  const pageSize = clampInteger(
    query.pageSize,
    1,
    INTEGRATION_DISPATCH_PAGE_SIZE_MAX,
    INTEGRATION_DISPATCH_PAGE_SIZE_DEFAULT
  );

  const totalRow = await countDispatchesByIntegrationAndOrganization({
    db: adminCheck.db,
    organizationId,
    integrationId,
  });
  const totalItems = Number(totalRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const boundedPage = Math.min(page, totalPages);
  const items = await listDispatchesByIntegrationAndOrganization({
    db: adminCheck.db,
    organizationId,
    integrationId,
    page: boundedPage,
    pageSize,
  });

  return {
    status: 200 as const,
    body: {
      items: items.map(item => ({
        id: item.id,
        integrationId: item.integrationId,
        provider: item.provider as IntegrationProvider,
        eventType: item.eventType as IntegrationEventType,
        status: item.status as IntegrationDispatchStatus,
        attemptCount: Number(item.attemptCount ?? 0),
        createdAt: item.createdAt?.toISOString() ?? null,
        createdAtMs: item.createdAt?.getTime() ?? null,
        nextAttemptAt: item.nextAttemptAt?.toISOString() ?? null,
        nextAttemptAtMs: item.nextAttemptAt?.getTime() ?? null,
        deliveredAt: item.deliveredAt?.toISOString() ?? null,
        deliveredAtMs: item.deliveredAt?.getTime() ?? null,
        lastError: item.lastError,
        lastErrorCode: item.lastErrorCode,
        lastErrorStatus:
          typeof item.lastErrorStatus === "number"
            ? item.lastErrorStatus
            : null,
      })),
      page: boundedPage,
      pageSize,
      totalItems,
      totalPages,
    },
  };
};

const enqueueDispatchById = async ({
  env,
  dispatchId,
}: {
  env: CloudflareBindings;
  dispatchId: string;
}) => {
  if (!env.INTEGRATION_DISPATCH_QUEUE) {
    throw new Error("INTEGRATION_DISPATCH_QUEUE is not configured");
  }

  await env.INTEGRATION_DISPATCH_QUEUE.send(
    { dispatchId } satisfies IntegrationDispatchQueueMessage,
    {
      contentType: "json",
    }
  );
};

export const replayIntegrationDispatch = async ({
  env,
  organizationId,
  session,
  integrationId,
  dispatchId,
}: {
  env: CloudflareBindings;
  organizationId: string;
  session: AppHonoEnv["Variables"]["session"];
  integrationId: string;
  dispatchId: string;
}) => {
  const adminCheck = await requireOrganizationAdmin({
    env,
    organizationId,
    session,
  });
  if (!adminCheck.ok) return adminCheck.response;

  const dispatch = await findDispatchByIdIntegrationAndOrganization({
    db: adminCheck.db,
    id: dispatchId,
    integrationId,
    organizationId,
  });
  if (!dispatch) {
    return {
      status: 404 as const,
      body: { error: "integration dispatch not found" },
    };
  }

  if (!["failed_permanent", "failed_dlq"].includes(dispatch.status)) {
    return {
      status: 409 as const,
      body: { error: "Only failed dispatches can be replayed" },
    };
  }

  await markDispatchPendingForReplay({
    db: adminCheck.db,
    id: dispatch.id,
  });
  try {
    await enqueueDispatchById({
      env,
      dispatchId: dispatch.id,
    });
  } catch (error) {
    try {
      await restoreDispatchAfterReplayEnqueueFailure({
        db: adminCheck.db,
        id: dispatch.id,
        status: dispatch.status as "failed_permanent" | "failed_dlq",
        nextAttemptAt: dispatch.nextAttemptAt,
        processingStartedAt: dispatch.processingStartedAt,
        deliveredAt: dispatch.deliveredAt,
        lastError: dispatch.lastError,
        lastErrorCode: dispatch.lastErrorCode,
        lastErrorStatus: dispatch.lastErrorStatus,
        lastErrorRetryAfterSeconds: dispatch.lastErrorRetryAfterSeconds,
        queueMessageId: dispatch.queueMessageId,
      });
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Failed to enqueue integration dispatch replay",
        { cause: rollbackError }
      );
    }

    throw error;
  }

  const replayed = await findDispatchByIdIntegrationAndOrganization({
    db: adminCheck.db,
    id: dispatch.id,
    integrationId,
    organizationId,
  });

  return {
    status: 200 as const,
    body: {
      id: dispatch.id,
      status: (replayed?.status ?? "pending") as IntegrationDispatchStatus,
      replayed: true,
    },
  };
};

export const dispatchEmailReceivedEvent = async ({
  env,
  organizationId,
  addressId,
  emailId,
  attachmentCount,
}: {
  env: CloudflareBindings;
  organizationId: string;
  addressId: string;
  emailId: string;
  attachmentCount?: number;
}) => {
  const db = getDb(env);
  const source = await findEmailReceivedSourceById({
    db,
    organizationId,
    emailId,
  });
  if (!source || source.addressId !== addressId) {
    return { queuedCount: 0 };
  }

  const subscriptions = await listEnabledSubscriptionsForAddressAndEvent({
    db,
    organizationId,
    addressId,
    eventType: EMAIL_RECEIVED_EVENT_TYPE,
  });
  if (subscriptions.length === 0) {
    return { queuedCount: 0 };
  }

  const senderLabel = source.sender?.trim() || source.from;
  const occurredAt =
    source.receivedAt?.toISOString() ?? new Date().toISOString();
  const payload: EmailReceivedPayload = {
    eventId: crypto.randomUUID(),
    eventType: EMAIL_RECEIVED_EVENT_TYPE,
    occurredAt,
    organizationId,
    addressId,
    address: source.address,
    emailId: source.emailId,
    messageId: source.messageId ?? null,
    from: source.from,
    senderLabel,
    subject: source.subject ?? null,
    preview: buildPreview(source.bodyText || source.bodyHtml || source.raw),
    attachmentCount: attachmentCount ?? 0,
  };
  const retryConfig = getIntegrationQueueRetryConfig(env);
  const maxAttemptWindowMs = retryConfig.retryWindowSeconds * 1000;
  let queuedCount = 0;

  for (const subscription of subscriptions) {
    const dispatchId = crypto.randomUUID();
    const idempotencyKey = await hashForRateLimitKey(
      `${subscription.integrationId}:${source.emailId}:${subscription.eventType}`
    );

    try {
      await insertIntegrationDispatch({
        db,
        values: {
          id: dispatchId,
          organizationId,
          integrationId: subscription.integrationId,
          subscriptionId: subscription.subscriptionId,
          provider: subscription.provider,
          eventType: subscription.eventType,
          sourceEmailId: source.emailId,
          payloadJson: JSON.stringify(payload),
          idempotencyKey,
          status: "pending",
          attemptCount: 0,
          maxAttemptWindowMs,
          nextAttemptAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }

    try {
      await enqueueDispatchById({
        env,
        dispatchId,
      });
      queuedCount += 1;
    } catch (error) {
      await markDispatchFailed({
        db,
        id: dispatchId,
        status: "failed_permanent",
        lastError:
          error instanceof Error
            ? error.message
            : "INTEGRATION_DISPATCH_QUEUE is not configured",
        lastErrorCode: "queue_enqueue_failed",
      });
    }
  }

  return { queuedCount };
};

const processDispatchQueueMessage = async ({
  message,
  env,
}: {
  message: Message<IntegrationDispatchQueueMessage>;
  env: CloudflareBindings;
}) => {
  const payload = parseQueueMessage(message.body);
  if (!payload) {
    message.ack();
    return;
  }

  const db = getDb(env);
  const dispatch = await findDispatchById({
    db,
    id: payload.dispatchId,
  });
  if (!dispatch) {
    message.ack();
    return;
  }

  if (TERMINAL_STATUSES.has(dispatch.status as IntegrationDispatchStatus)) {
    message.ack();
    return;
  }

  const integration = await findIntegrationByIdAndOrganization({
    db,
    id: dispatch.integrationId,
    organizationId: dispatch.organizationId,
  });
  if (!integration) {
    await markDispatchFailed({
      db,
      id: dispatch.id,
      status: "failed_permanent",
      lastError: "Integration not found",
      lastErrorCode: "integration_not_found",
    });
    message.ack();
    return;
  }

  const secret = await findActiveIntegrationSecret({
    db,
    integrationId: integration.id,
    version: Number(integration.activeSecretVersion),
  });
  if (!secret) {
    await markDispatchFailed({
      db,
      id: dispatch.id,
      status: "failed_permanent",
      lastError: "Integration secret not found",
      lastErrorCode: "integration_secret_not_found",
    });
    message.ack();
    return;
  }

  const encryptionKey = getIntegrationSecretEncryptionKey(env);
  if (!encryptionKey) {
    await markDispatchFailed({
      db,
      id: dispatch.id,
      status: "failed_permanent",
      lastError: "INTEGRATION_SECRET_ENCRYPTION_KEY is not configured",
      lastErrorCode: "integration_secret_encryption_key_missing",
    });
    message.ack();
    return;
  }

  const now = new Date();
  if (
    hasExceededRetryWindow({
      createdAt: dispatch.createdAt,
      maxAttemptWindowMs: dispatch.maxAttemptWindowMs,
      now,
    })
  ) {
    await markDispatchFailed({
      db,
      id: dispatch.id,
      status: "failed_permanent",
      lastError: "Retry window exceeded",
      lastErrorCode: "retry_window_exceeded",
    });
    message.ack();
    return;
  }

  const attemptCount = Math.max(1, Number(dispatch.attemptCount ?? 0) + 1);
  const startedAt = new Date();
  const dailyDispatchWindowStart = new Date(
    startedAt.getTime() - INTEGRATION_DAILY_DISPATCH_WINDOW_MS
  );
  const deliveryAttemptId = crypto.randomUUID();
  const reservedDeliveryAttempt =
    await reserveDeliveryAttemptIfUnderOrganizationDailyLimit({
      db,
      values: {
        id: deliveryAttemptId,
        dispatchId: dispatch.id,
        organizationId: dispatch.organizationId,
        integrationId: dispatch.integrationId,
        attemptNumber: attemptCount,
        outcome: "processing",
        startedAt,
      },
      startedAfter: dailyDispatchWindowStart,
      maxAttempts: getMaxIntegrationDispatchesPerOrganizationPerDay(env),
    });

  if (!reservedDeliveryAttempt) {
    const oldestAttempt =
      await findOldestDeliveryAttemptStartedAtByOrganizationSince({
        db,
        organizationId: dispatch.organizationId,
        startedAfter: dailyDispatchWindowStart,
      });
    const delaySeconds = buildDailyDispatchLimitDelaySeconds({
      now: startedAt,
      oldestStartedAt: oldestAttempt?.startedAt,
    });
    await markDispatchRetryScheduled({
      db,
      id: dispatch.id,
      nextAttemptAt: new Date(startedAt.getTime() + delaySeconds * 1000),
      lastError: "Organization reached the daily integration dispatch limit",
      lastErrorCode: "organization_daily_dispatch_limit_reached",
    });
    message.retry({ delaySeconds });
    return;
  }

  const claimed = await markDispatchProcessing({
    db,
    id: dispatch.id,
    attemptCount,
    queueMessageId: message.id,
  });
  if (!claimed) {
    await deleteDeliveryAttemptById({
      db,
      id: deliveryAttemptId,
    });
    message.ack();
    return;
  }
  const adapter = getIntegrationAdapter(
    integration.provider as IntegrationProvider
  );

  try {
    const publicConfig = (() => {
      try {
        return JSON.parse(integration.publicConfigJson);
      } catch (error) {
        throw new IntegrationDispatchPreparationError(
          "Stored integration public config is invalid",
          "integration_public_config_invalid",
          error
        );
      }
    })();
    const secretConfig = await (async () => {
      try {
        return JSON.parse(
          await decryptSecret({
            encrypted: secret.encryptedConfigJson,
            encodedKey: encryptionKey,
          })
        );
      } catch (error) {
        throw new IntegrationDispatchPreparationError(
          "Stored integration secret config is invalid",
          "integration_secret_config_invalid",
          error
        );
      }
    })();
    const dispatchPayload = (() => {
      try {
        return parseDispatchPayload(dispatch.payloadJson);
      } catch (error) {
        throw new IntegrationDispatchPreparationError(
          "Stored integration dispatch payload is invalid",
          "integration_dispatch_payload_invalid",
          error
        );
      }
    })();

    await adapter.deliver({
      env,
      payload: dispatchPayload,
      publicConfig,
      secretConfig,
    });

    await completeDeliveryAttempt({
      db,
      id: deliveryAttemptId,
      outcome: "sent",
      completedAt: new Date(),
    });
    await markDispatchSent({
      db,
      id: dispatch.id,
    });
    message.ack();
  } catch (error) {
    const failure = classifyIntegrationDispatchFailure({ adapter, error });

    await completeDeliveryAttempt({
      db,
      id: deliveryAttemptId,
      outcome: "failed",
      error: failure.message,
      errorCode: failure.code,
      errorStatus: failure.status,
      errorRetryAfterSeconds: failure.retryAfterSeconds,
      completedAt: new Date(),
    });

    const exceededWindow = hasExceededRetryWindow({
      createdAt: dispatch.createdAt,
      maxAttemptWindowMs: dispatch.maxAttemptWindowMs,
      now: new Date(),
    });
    if (!failure.retryable || exceededWindow) {
      await markDispatchFailed({
        db,
        id: dispatch.id,
        status: "failed_permanent",
        lastError: failure.message,
        lastErrorCode: failure.code,
        lastErrorStatus: failure.status,
        lastErrorRetryAfterSeconds: failure.retryAfterSeconds,
      });
      message.ack();
      return;
    }

    const delaySeconds = buildRetryDelaySeconds(attemptCount, env);
    await markDispatchRetryScheduled({
      db,
      id: dispatch.id,
      nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
      lastError: failure.message,
      lastErrorCode: failure.code,
      lastErrorStatus: failure.status,
      lastErrorRetryAfterSeconds: failure.retryAfterSeconds,
    });
    message.retry({ delaySeconds });
  }
};

export const handleIntegrationDispatchQueueBatch = async ({
  batch,
  env,
}: {
  batch: MessageBatch;
  env: CloudflareBindings;
}) => {
  for (const message of batch.messages as readonly Message<IntegrationDispatchQueueMessage>[]) {
    try {
      await processDispatchQueueMessage({
        message,
        env,
      });
    } catch {
      message.retry({ delaySeconds: 60 });
    }
  }
};
