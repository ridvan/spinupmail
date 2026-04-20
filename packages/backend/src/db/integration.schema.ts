import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { organizations, users } from "./auth.schema";
import { emailAddresses, emails } from "./email.schema";

export const organizationIntegrations = sqliteTable(
  "organization_integrations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicConfigJson: text("public_config_json").notNull(),
    activeSecretVersion: integer("active_secret_version").notNull(),
    lastValidatedAt: integer("last_validated_at", {
      mode: "timestamp_ms",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  table => [
    uniqueIndex("organization_integrations_org_id_uidx").on(
      table.organizationId,
      table.id
    ),
    index("organization_integrations_org_provider_status_idx").on(
      table.organizationId,
      table.provider,
      table.status
    ),
    uniqueIndex("organization_integrations_org_provider_name_uidx").on(
      table.organizationId,
      table.provider,
      table.name
    ),
    uniqueIndex("organization_integrations_org_provider_config_uidx").on(
      table.organizationId,
      table.provider,
      table.publicConfigJson
    ),
  ]
);

export const organizationIntegrationSecrets = sqliteTable(
  "organization_integration_secrets",
  {
    integrationId: text("integration_id")
      .notNull()
      .references(() => organizationIntegrations.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    encryptedConfigJson: text("encrypted_config_json").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  table => [
    primaryKey({
      name: "organization_integration_secrets_pk",
      columns: [table.integrationId, table.version],
    }),
    uniqueIndex("organization_integration_secrets_integration_version_uidx").on(
      table.integrationId,
      table.version
    ),
  ]
);

export const addressIntegrationSubscriptions = sqliteTable(
  "address_integration_subscriptions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    addressId: text("address_id").notNull(),
    integrationId: text("integration_id").notNull(),
    eventType: text("event_type").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  table => [
    uniqueIndex("address_integration_subscriptions_org_id_uidx").on(
      table.organizationId,
      table.id
    ),
    uniqueIndex("address_integration_subscriptions_address_event_uidx").on(
      table.addressId,
      table.integrationId,
      table.eventType
    ),
    index("address_integration_subscriptions_org_address_event_idx").on(
      table.organizationId,
      table.addressId,
      table.eventType
    ),
    index("address_integration_subscriptions_integration_event_idx").on(
      table.integrationId,
      table.eventType
    ),
    foreignKey({
      columns: [table.organizationId, table.addressId],
      foreignColumns: [emailAddresses.organizationId, emailAddresses.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.organizationId, table.integrationId],
      foreignColumns: [
        organizationIntegrations.organizationId,
        organizationIntegrations.id,
      ],
    }).onDelete("cascade"),
  ]
);

export const integrationDispatches = sqliteTable(
  "integration_dispatches",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    integrationId: text("integration_id").notNull(),
    subscriptionId: text("subscription_id").notNull(),
    provider: text("provider").notNull(),
    eventType: text("event_type").notNull(),
    sourceEmailId: text("source_email_id")
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    payloadJson: text("payload_json").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    maxAttemptWindowMs: integer("max_attempt_window_ms").notNull(),
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }),
    processingStartedAt: integer("processing_started_at", {
      mode: "timestamp_ms",
    }),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    lastErrorCode: text("last_error_code"),
    lastErrorStatus: integer("last_error_status"),
    lastErrorRetryAfterSeconds: integer("last_error_retry_after_seconds"),
    queueMessageId: text("queue_message_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  table => [
    uniqueIndex("integration_dispatches_org_id_uidx").on(
      table.organizationId,
      table.id
    ),
    uniqueIndex("integration_dispatches_idempotency_key_uidx").on(
      table.idempotencyKey
    ),
    index("integration_dispatches_integration_status_created_idx").on(
      table.integrationId,
      table.status,
      table.createdAt
    ),
    index("integration_dispatches_org_status_created_idx").on(
      table.organizationId,
      table.status,
      table.createdAt
    ),
    index("integration_dispatches_status_next_attempt_idx").on(
      table.status,
      table.nextAttemptAt
    ),
    index("integration_dispatches_source_email_idx").on(table.sourceEmailId),
    foreignKey({
      columns: [table.organizationId, table.integrationId],
      foreignColumns: [
        organizationIntegrations.organizationId,
        organizationIntegrations.id,
      ],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.organizationId, table.subscriptionId],
      foreignColumns: [
        addressIntegrationSubscriptions.organizationId,
        addressIntegrationSubscriptions.id,
      ],
    }).onDelete("cascade"),
  ]
);

export const integrationDeliveryAttempts = sqliteTable(
  "integration_delivery_attempts",
  {
    id: text("id").primaryKey(),
    dispatchId: text("dispatch_id").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    integrationId: text("integration_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    outcome: text("outcome").notNull(),
    error: text("error"),
    errorCode: text("error_code"),
    errorStatus: integer("error_status"),
    errorRetryAfterSeconds: integer("error_retry_after_seconds"),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  table => [
    uniqueIndex("integration_delivery_attempts_dispatch_attempt_uidx").on(
      table.dispatchId,
      table.attemptNumber
    ),
    index("integration_delivery_attempts_integration_started_idx").on(
      table.integrationId,
      table.startedAt
    ),
    foreignKey({
      columns: [table.organizationId, table.dispatchId],
      foreignColumns: [
        integrationDispatches.organizationId,
        integrationDispatches.id,
      ],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.organizationId, table.integrationId],
      foreignColumns: [
        organizationIntegrations.organizationId,
        organizationIntegrations.id,
      ],
    }).onDelete("cascade"),
  ]
);

export const organizationIntegrationsRelations = relations(
  organizationIntegrations,
  ({ many, one }) => ({
    organization: one(organizations, {
      fields: [organizationIntegrations.organizationId],
      references: [organizations.id],
    }),
    createdByUser: one(users, {
      fields: [organizationIntegrations.createdByUserId],
      references: [users.id],
    }),
    secrets: many(organizationIntegrationSecrets),
    subscriptions: many(addressIntegrationSubscriptions),
    dispatches: many(integrationDispatches),
    deliveryAttempts: many(integrationDeliveryAttempts),
  })
);

export const organizationIntegrationSecretsRelations = relations(
  organizationIntegrationSecrets,
  ({ one }) => ({
    integration: one(organizationIntegrations, {
      fields: [organizationIntegrationSecrets.integrationId],
      references: [organizationIntegrations.id],
    }),
  })
);

export const addressIntegrationSubscriptionsRelations = relations(
  addressIntegrationSubscriptions,
  ({ many, one }) => ({
    organization: one(organizations, {
      fields: [addressIntegrationSubscriptions.organizationId],
      references: [organizations.id],
    }),
    address: one(emailAddresses, {
      fields: [addressIntegrationSubscriptions.addressId],
      references: [emailAddresses.id],
    }),
    integration: one(organizationIntegrations, {
      fields: [addressIntegrationSubscriptions.integrationId],
      references: [organizationIntegrations.id],
    }),
    dispatches: many(integrationDispatches),
  })
);

export const integrationDispatchesRelations = relations(
  integrationDispatches,
  ({ many, one }) => ({
    organization: one(organizations, {
      fields: [integrationDispatches.organizationId],
      references: [organizations.id],
    }),
    integration: one(organizationIntegrations, {
      fields: [integrationDispatches.integrationId],
      references: [organizationIntegrations.id],
    }),
    subscription: one(addressIntegrationSubscriptions, {
      fields: [integrationDispatches.subscriptionId],
      references: [addressIntegrationSubscriptions.id],
    }),
    sourceEmail: one(emails, {
      fields: [integrationDispatches.sourceEmailId],
      references: [emails.id],
    }),
    attempts: many(integrationDeliveryAttempts),
  })
);

export const integrationDeliveryAttemptsRelations = relations(
  integrationDeliveryAttempts,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [integrationDeliveryAttempts.organizationId],
      references: [organizations.id],
    }),
    integration: one(organizationIntegrations, {
      fields: [integrationDeliveryAttempts.integrationId],
      references: [organizationIntegrations.id],
    }),
    dispatch: one(integrationDispatches, {
      fields: [integrationDeliveryAttempts.dispatchId],
      references: [integrationDispatches.id],
    }),
  })
);
