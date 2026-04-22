import { and, count, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import {
  addressIntegrationSubscriptions,
  emailAddresses,
  emails,
  integrationDeliveryAttempts,
  integrationDispatches,
  organizationIntegrationSecrets,
  organizationIntegrations,
} from "@/db";
import type { AppDatabase, AppDb } from "@/platform/db/client";

const integrationSelect = {
  id: organizationIntegrations.id,
  organizationId: organizationIntegrations.organizationId,
  provider: organizationIntegrations.provider,
  name: organizationIntegrations.name,
  status: organizationIntegrations.status,
  createdByUserId: organizationIntegrations.createdByUserId,
  publicConfigJson: organizationIntegrations.publicConfigJson,
  activeSecretVersion: organizationIntegrations.activeSecretVersion,
  lastValidatedAt: organizationIntegrations.lastValidatedAt,
  createdAt: organizationIntegrations.createdAt,
  updatedAt: organizationIntegrations.updatedAt,
};

const integrationDispatchSelect = {
  id: integrationDispatches.id,
  organizationId: integrationDispatches.organizationId,
  integrationId: integrationDispatches.integrationId,
  subscriptionId: integrationDispatches.subscriptionId,
  provider: integrationDispatches.provider,
  eventType: integrationDispatches.eventType,
  sourceEmailId: integrationDispatches.sourceEmailId,
  payloadJson: integrationDispatches.payloadJson,
  idempotencyKey: integrationDispatches.idempotencyKey,
  status: integrationDispatches.status,
  attemptCount: integrationDispatches.attemptCount,
  maxAttemptWindowMs: integrationDispatches.maxAttemptWindowMs,
  nextAttemptAt: integrationDispatches.nextAttemptAt,
  processingStartedAt: integrationDispatches.processingStartedAt,
  deliveredAt: integrationDispatches.deliveredAt,
  lastError: integrationDispatches.lastError,
  lastErrorCode: integrationDispatches.lastErrorCode,
  lastErrorStatus: integrationDispatches.lastErrorStatus,
  lastErrorRetryAfterSeconds: integrationDispatches.lastErrorRetryAfterSeconds,
  queueMessageId: integrationDispatches.queueMessageId,
  createdAt: integrationDispatches.createdAt,
  updatedAt: integrationDispatches.updatedAt,
};

export const listIntegrationsByOrganization = ({
  db,
  organizationId,
}: {
  db: AppDb;
  organizationId: string;
}) =>
  db
    .select({
      ...integrationSelect,
      mailboxCount: sql<number>`count(distinct ${addressIntegrationSubscriptions.addressId})`,
    })
    .from(organizationIntegrations)
    .leftJoin(
      addressIntegrationSubscriptions,
      and(
        eq(
          addressIntegrationSubscriptions.integrationId,
          organizationIntegrations.id
        ),
        eq(addressIntegrationSubscriptions.enabled, true)
      )
    )
    .where(eq(organizationIntegrations.organizationId, organizationId))
    .groupBy(organizationIntegrations.id)
    .orderBy(organizationIntegrations.createdAt);

export const countIntegrationsByOrganization = ({
  db,
  organizationId,
}: {
  db: AppDb;
  organizationId: string;
}) =>
  db
    .select({
      count: count(),
    })
    .from(organizationIntegrations)
    .where(eq(organizationIntegrations.organizationId, organizationId))
    .get();

export const findIntegrationByIdAndOrganization = ({
  db,
  id,
  organizationId,
}: {
  db: AppDb;
  id: string;
  organizationId: string;
}) =>
  db
    .select(integrationSelect)
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.id, id),
        eq(organizationIntegrations.organizationId, organizationId)
      )
    )
    .get();

export const findIntegrationsByIdsAndOrganization = ({
  db,
  ids,
  organizationId,
}: {
  db: AppDb;
  ids: string[];
  organizationId: string;
}) =>
  ids.length === 0
    ? Promise.resolve([])
    : db
        .select(integrationSelect)
        .from(organizationIntegrations)
        .where(
          and(
            inArray(organizationIntegrations.id, ids),
            eq(organizationIntegrations.organizationId, organizationId)
          )
        );

export const insertIntegration = ({
  db,
  values,
}: {
  db: AppDb;
  values: typeof organizationIntegrations.$inferInsert;
}) => db.insert(organizationIntegrations).values(values).run();

export const buildInsertIntegrationStatement = ({
  db,
  values,
}: {
  db: AppDb;
  values: typeof organizationIntegrations.$inferInsert;
}) =>
  db.$client
    .prepare(
      `
      INSERT INTO organization_integrations (
        id,
        organization_id,
        provider,
        name,
        status,
        created_by_user_id,
        public_config_json,
        active_secret_version,
        last_validated_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .bind(
      values.id,
      values.organizationId,
      values.provider,
      values.name,
      values.status,
      values.createdByUserId,
      values.publicConfigJson,
      values.activeSecretVersion,
      values.lastValidatedAt instanceof Date
        ? values.lastValidatedAt.getTime()
        : values.lastValidatedAt,
      values.createdAt instanceof Date
        ? values.createdAt.getTime()
        : (values.createdAt ?? Date.now()),
      values.updatedAt instanceof Date
        ? values.updatedAt.getTime()
        : (values.updatedAt ?? Date.now())
    );

export const insertIntegrationSecret = ({
  db,
  values,
}: {
  db: AppDb;
  values: typeof organizationIntegrationSecrets.$inferInsert;
}) => db.insert(organizationIntegrationSecrets).values(values).run();

export const buildInsertIntegrationSecretStatement = ({
  db,
  values,
}: {
  db: AppDb;
  values: typeof organizationIntegrationSecrets.$inferInsert;
}) =>
  db.$client
    .prepare(
      `
      INSERT INTO organization_integration_secrets (
        integration_id,
        version,
        encrypted_config_json,
        created_at
      ) VALUES (?, ?, ?, ?)
    `
    )
    .bind(
      values.integrationId,
      values.version,
      values.encryptedConfigJson,
      values.createdAt instanceof Date
        ? values.createdAt.getTime()
        : values.createdAt
    );

export const findActiveIntegrationSecret = ({
  db,
  integrationId,
  version,
}: {
  db: AppDb;
  integrationId: string;
  version: number;
}) =>
  db
    .select({
      integrationId: organizationIntegrationSecrets.integrationId,
      version: organizationIntegrationSecrets.version,
      encryptedConfigJson: organizationIntegrationSecrets.encryptedConfigJson,
      createdAt: organizationIntegrationSecrets.createdAt,
    })
    .from(organizationIntegrationSecrets)
    .where(
      and(
        eq(organizationIntegrationSecrets.integrationId, integrationId),
        eq(organizationIntegrationSecrets.version, version)
      )
    )
    .get();

export const deleteIntegrationByIdAndOrganization = ({
  db,
  id,
  organizationId,
}: {
  db: AppDb;
  id: string;
  organizationId: string;
}) =>
  db
    .delete(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.id, id),
        eq(organizationIntegrations.organizationId, organizationId)
      )
    )
    .run();

export const countEnabledSubscriptionsForIntegration = ({
  db,
  integrationId,
  organizationId,
}: {
  db: AppDb;
  integrationId: string;
  organizationId: string;
}) =>
  db
    .select({
      count: count(),
    })
    .from(addressIntegrationSubscriptions)
    .where(
      and(
        eq(addressIntegrationSubscriptions.integrationId, integrationId),
        eq(addressIntegrationSubscriptions.organizationId, organizationId),
        eq(addressIntegrationSubscriptions.enabled, true)
      )
    )
    .get();

export const deleteSubscriptionsForIntegration = ({
  db,
  integrationId,
  organizationId,
}: {
  db: AppDb;
  integrationId: string;
  organizationId: string;
}) =>
  db
    .delete(addressIntegrationSubscriptions)
    .where(
      and(
        eq(addressIntegrationSubscriptions.integrationId, integrationId),
        eq(addressIntegrationSubscriptions.organizationId, organizationId)
      )
    )
    .run();

export const listAddressSubscriptionsByAddressIds = ({
  db,
  organizationId,
  addressIds,
}: {
  db: AppDb;
  organizationId: string;
  addressIds: string[];
}) =>
  addressIds.length === 0
    ? Promise.resolve([])
    : db
        .select({
          id: addressIntegrationSubscriptions.id,
          addressId: addressIntegrationSubscriptions.addressId,
          integrationId: addressIntegrationSubscriptions.integrationId,
          eventType: addressIntegrationSubscriptions.eventType,
          enabled: addressIntegrationSubscriptions.enabled,
          integrationName: organizationIntegrations.name,
          integrationProvider: organizationIntegrations.provider,
          integrationStatus: organizationIntegrations.status,
        })
        .from(addressIntegrationSubscriptions)
        .innerJoin(
          organizationIntegrations,
          and(
            eq(
              organizationIntegrations.id,
              addressIntegrationSubscriptions.integrationId
            ),
            eq(
              organizationIntegrations.organizationId,
              addressIntegrationSubscriptions.organizationId
            )
          )
        )
        .where(
          and(
            inArray(addressIntegrationSubscriptions.addressId, addressIds),
            eq(addressIntegrationSubscriptions.organizationId, organizationId)
          )
        );

export const deleteAddressSubscriptionsByAddressAndEventType = ({
  db,
  organizationId,
  addressId,
  eventType,
}: {
  db: AppDatabase;
  organizationId: string;
  addressId: string;
  eventType: string;
}) =>
  db
    .delete(addressIntegrationSubscriptions)
    .where(
      and(
        eq(addressIntegrationSubscriptions.organizationId, organizationId),
        eq(addressIntegrationSubscriptions.addressId, addressId),
        eq(addressIntegrationSubscriptions.eventType, eventType)
      )
    )
    .run();

export const buildDeleteAddressSubscriptionsByAddressAndEventTypeStatement = ({
  db,
  organizationId,
  addressId,
  eventType,
}: {
  db: AppDb;
  organizationId: string;
  addressId: string;
  eventType: string;
}) =>
  db.$client
    .prepare(
      `
      DELETE FROM address_integration_subscriptions
      WHERE organization_id = ?
        AND address_id = ?
        AND event_type = ?
    `
    )
    .bind(organizationId, addressId, eventType);

export const insertAddressSubscriptions = ({
  db,
  values,
}: {
  db: AppDatabase;
  values: (typeof addressIntegrationSubscriptions.$inferInsert)[];
}) =>
  values.length === 0
    ? Promise.resolve()
    : db.insert(addressIntegrationSubscriptions).values(values).run();

export const buildInsertAddressSubscriptionsStatements = ({
  db,
  values,
}: {
  db: AppDb;
  values: (typeof addressIntegrationSubscriptions.$inferInsert)[];
}) =>
  values.map(value =>
    db.$client
      .prepare(
        `
        INSERT INTO address_integration_subscriptions (
          id,
          organization_id,
          address_id,
          integration_id,
          event_type,
          enabled,
          created_at,
          updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1
          FROM email_addresses
          WHERE organization_id = ?
            AND id = ?
        )
      `
      )
      .bind(
        value.id,
        value.organizationId,
        value.addressId,
        value.integrationId,
        value.eventType,
        value.enabled ? 1 : 0,
        value.createdAt instanceof Date
          ? value.createdAt.getTime()
          : value.createdAt,
        value.updatedAt instanceof Date
          ? value.updatedAt.getTime()
          : value.updatedAt,
        value.organizationId,
        value.addressId
      )
  );

export const findEmailReceivedSourceById = ({
  db,
  organizationId,
  emailId,
}: {
  db: AppDb;
  organizationId: string;
  emailId: string;
}) =>
  db
    .select({
      emailId: emails.id,
      messageId: emails.messageId,
      from: emails.from,
      sender: emails.sender,
      subject: emails.subject,
      bodyHtml: emails.bodyHtml,
      bodyText: emails.bodyText,
      raw: emails.raw,
      receivedAt: emails.receivedAt,
      addressId: emailAddresses.id,
      address: emailAddresses.address,
      organizationId: emailAddresses.organizationId,
    })
    .from(emails)
    .innerJoin(emailAddresses, eq(emailAddresses.id, emails.addressId))
    .where(
      and(
        eq(emails.id, emailId),
        eq(emailAddresses.organizationId, organizationId)
      )
    )
    .get();

export const listEnabledSubscriptionsForAddressAndEvent = ({
  db,
  organizationId,
  addressId,
  eventType,
}: {
  db: AppDb;
  organizationId: string;
  addressId: string;
  eventType: string;
}) =>
  db
    .select({
      subscriptionId: addressIntegrationSubscriptions.id,
      eventType: addressIntegrationSubscriptions.eventType,
      integrationId: organizationIntegrations.id,
      provider: organizationIntegrations.provider,
      name: organizationIntegrations.name,
      publicConfigJson: organizationIntegrations.publicConfigJson,
      activeSecretVersion: organizationIntegrations.activeSecretVersion,
      status: organizationIntegrations.status,
    })
    .from(addressIntegrationSubscriptions)
    .innerJoin(
      organizationIntegrations,
      and(
        eq(
          organizationIntegrations.id,
          addressIntegrationSubscriptions.integrationId
        ),
        eq(
          organizationIntegrations.organizationId,
          addressIntegrationSubscriptions.organizationId
        )
      )
    )
    .where(
      and(
        eq(addressIntegrationSubscriptions.organizationId, organizationId),
        eq(addressIntegrationSubscriptions.addressId, addressId),
        eq(addressIntegrationSubscriptions.eventType, eventType),
        eq(addressIntegrationSubscriptions.enabled, true),
        eq(organizationIntegrations.status, "active")
      )
    );

export const insertIntegrationDispatch = ({
  db,
  values,
}: {
  db: AppDb;
  values: typeof integrationDispatches.$inferInsert;
}) => db.insert(integrationDispatches).values(values).run();

export const findDispatchById = ({ db, id }: { db: AppDb; id: string }) =>
  db
    .select(integrationDispatchSelect)
    .from(integrationDispatches)
    .where(eq(integrationDispatches.id, id))
    .get();

export const findDispatchByIdIntegrationAndOrganization = ({
  db,
  id,
  integrationId,
  organizationId,
}: {
  db: AppDb;
  id: string;
  integrationId: string;
  organizationId: string;
}) =>
  db
    .select(integrationDispatchSelect)
    .from(integrationDispatches)
    .where(
      and(
        eq(integrationDispatches.id, id),
        eq(integrationDispatches.integrationId, integrationId),
        eq(integrationDispatches.organizationId, organizationId)
      )
    )
    .get();

export const markDispatchProcessing = ({
  db,
  id,
  attemptCount,
  queueMessageId,
}: {
  db: AppDb;
  id: string;
  attemptCount: number;
  queueMessageId: string;
}) =>
  db
    .update(integrationDispatches)
    .set({
      status: "processing",
      attemptCount,
      processingStartedAt: new Date(),
      queueMessageId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(integrationDispatches.id, id),
        or(
          eq(integrationDispatches.status, "pending"),
          eq(integrationDispatches.status, "retry_scheduled")
        )
      )
    )
    .run()
    .then(result => Number(result.meta.changes ?? 0) > 0);

export const markDispatchSent = ({ db, id }: { db: AppDb; id: string }) =>
  db
    .update(integrationDispatches)
    .set({
      status: "sent",
      deliveredAt: new Date(),
      nextAttemptAt: null,
      lastError: null,
      lastErrorCode: null,
      lastErrorStatus: null,
      lastErrorRetryAfterSeconds: null,
      updatedAt: new Date(),
    })
    .where(eq(integrationDispatches.id, id))
    .run();

export const markDispatchRetryScheduled = ({
  db,
  id,
  nextAttemptAt,
  lastError,
  lastErrorCode,
  lastErrorStatus,
  lastErrorRetryAfterSeconds,
}: {
  db: AppDb;
  id: string;
  nextAttemptAt: Date;
  lastError: string;
  lastErrorCode: string;
  lastErrorStatus?: number | null;
  lastErrorRetryAfterSeconds?: number | null;
}) =>
  db
    .update(integrationDispatches)
    .set({
      status: "retry_scheduled",
      nextAttemptAt,
      lastError,
      lastErrorCode,
      lastErrorStatus: lastErrorStatus ?? null,
      lastErrorRetryAfterSeconds: lastErrorRetryAfterSeconds ?? null,
      updatedAt: new Date(),
    })
    .where(eq(integrationDispatches.id, id))
    .run();

export const markDispatchFailed = ({
  db,
  id,
  status,
  lastError,
  lastErrorCode,
  lastErrorStatus,
  lastErrorRetryAfterSeconds,
}: {
  db: AppDb;
  id: string;
  status: "failed_permanent" | "failed_dlq";
  lastError: string;
  lastErrorCode: string;
  lastErrorStatus?: number | null;
  lastErrorRetryAfterSeconds?: number | null;
}) =>
  db
    .update(integrationDispatches)
    .set({
      status,
      nextAttemptAt: null,
      lastError,
      lastErrorCode,
      lastErrorStatus: lastErrorStatus ?? null,
      lastErrorRetryAfterSeconds: lastErrorRetryAfterSeconds ?? null,
      updatedAt: new Date(),
    })
    .where(eq(integrationDispatches.id, id))
    .run();

export const markDispatchPendingForReplay = ({
  db,
  id,
}: {
  db: AppDb;
  id: string;
}) =>
  db
    .update(integrationDispatches)
    .set({
      status: "pending",
      nextAttemptAt: new Date(),
      processingStartedAt: null,
      deliveredAt: null,
      lastError: null,
      lastErrorCode: null,
      lastErrorStatus: null,
      lastErrorRetryAfterSeconds: null,
      queueMessageId: null,
      updatedAt: new Date(),
    })
    .where(eq(integrationDispatches.id, id))
    .run();

export const restoreDispatchAfterReplayEnqueueFailure = ({
  db,
  id,
  status,
  nextAttemptAt,
  processingStartedAt,
  deliveredAt,
  lastError,
  lastErrorCode,
  lastErrorStatus,
  lastErrorRetryAfterSeconds,
  queueMessageId,
}: {
  db: AppDb;
  id: string;
  status: "failed_permanent" | "failed_dlq";
  nextAttemptAt: Date | null;
  processingStartedAt: Date | null;
  deliveredAt: Date | null;
  lastError: string | null;
  lastErrorCode: string | null;
  lastErrorStatus: number | null;
  lastErrorRetryAfterSeconds: number | null;
  queueMessageId: string | null;
}) =>
  db
    .update(integrationDispatches)
    .set({
      status,
      nextAttemptAt,
      processingStartedAt,
      deliveredAt,
      lastError,
      lastErrorCode,
      lastErrorStatus,
      lastErrorRetryAfterSeconds,
      queueMessageId,
      updatedAt: new Date(),
    })
    .where(eq(integrationDispatches.id, id))
    .run();

export const insertDeliveryAttempt = ({
  db,
  values,
}: {
  db: AppDb;
  values: typeof integrationDeliveryAttempts.$inferInsert;
}) => db.insert(integrationDeliveryAttempts).values(values).run();

export const reserveDeliveryAttemptIfUnderOrganizationDailyLimit = ({
  db,
  values,
  startedAfter,
  maxAttempts,
}: {
  db: AppDb;
  values: typeof integrationDeliveryAttempts.$inferInsert;
  startedAfter: Date;
  maxAttempts: number;
}) =>
  db.$client
    .prepare(
      `
      INSERT INTO integration_delivery_attempts (
        id,
        dispatch_id,
        organization_id,
        integration_id,
        attempt_number,
        outcome,
        error,
        error_code,
        error_status,
        error_retry_after_seconds,
        started_at,
        completed_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE (
        SELECT count(*)
        FROM integration_delivery_attempts
        WHERE organization_id = ?
          AND started_at >= ?
      ) < ?
    `
    )
    .bind(
      values.id,
      values.dispatchId,
      values.organizationId,
      values.integrationId,
      values.attemptNumber,
      values.outcome,
      values.error ?? null,
      values.errorCode ?? null,
      values.errorStatus ?? null,
      values.errorRetryAfterSeconds ?? null,
      values.startedAt instanceof Date
        ? values.startedAt.getTime()
        : values.startedAt,
      values.completedAt instanceof Date
        ? values.completedAt.getTime()
        : (values.completedAt ?? null),
      values.organizationId,
      startedAfter.getTime(),
      maxAttempts
    )
    .run()
    .then(result => Number(result.meta.changes ?? 0) > 0);

export const completeDeliveryAttempt = ({
  db,
  id,
  outcome,
  error,
  errorCode,
  errorStatus,
  errorRetryAfterSeconds,
  completedAt,
}: {
  db: AppDb;
  id: string;
  outcome: string;
  error?: string | null;
  errorCode?: string | null;
  errorStatus?: number | null;
  errorRetryAfterSeconds?: number | null;
  completedAt: Date;
}) =>
  db
    .update(integrationDeliveryAttempts)
    .set({
      outcome,
      error: error ?? null,
      errorCode: errorCode ?? null,
      errorStatus: errorStatus ?? null,
      errorRetryAfterSeconds: errorRetryAfterSeconds ?? null,
      completedAt,
    })
    .where(eq(integrationDeliveryAttempts.id, id))
    .run();

export const deleteDeliveryAttemptById = ({
  db,
  id,
}: {
  db: AppDb;
  id: string;
}) =>
  db
    .delete(integrationDeliveryAttempts)
    .where(eq(integrationDeliveryAttempts.id, id))
    .run();

export const findOldestDeliveryAttemptStartedAtByOrganizationSince = ({
  db,
  organizationId,
  startedAfter,
}: {
  db: AppDb;
  organizationId: string;
  startedAfter: Date;
}) =>
  db
    .select({
      startedAt: integrationDeliveryAttempts.startedAt,
    })
    .from(integrationDeliveryAttempts)
    .where(
      and(
        eq(integrationDeliveryAttempts.organizationId, organizationId),
        gte(integrationDeliveryAttempts.startedAt, startedAfter)
      )
    )
    .orderBy(integrationDeliveryAttempts.startedAt)
    .limit(1)
    .get();

export const listDispatchesByIntegrationAndOrganization = ({
  db,
  organizationId,
  integrationId,
  page,
  pageSize,
}: {
  db: AppDb;
  organizationId: string;
  integrationId: string;
  page: number;
  pageSize: number;
}) => {
  const normalizedPage = Math.max(page, 1);
  const normalizedPageSize = Math.max(pageSize, 1);

  return db
    .select(integrationDispatchSelect)
    .from(integrationDispatches)
    .where(
      and(
        eq(integrationDispatches.organizationId, organizationId),
        eq(integrationDispatches.integrationId, integrationId)
      )
    )
    .orderBy(
      desc(integrationDispatches.createdAt),
      desc(integrationDispatches.id)
    )
    .limit(normalizedPageSize)
    .offset((normalizedPage - 1) * normalizedPageSize);
};

export const countDispatchesByIntegrationAndOrganization = ({
  db,
  organizationId,
  integrationId,
}: {
  db: AppDb;
  organizationId: string;
  integrationId: string;
}) =>
  db
    .select({
      count: count(),
    })
    .from(integrationDispatches)
    .where(
      and(
        eq(integrationDispatches.organizationId, organizationId),
        eq(integrationDispatches.integrationId, integrationId)
      )
    )
    .get();
