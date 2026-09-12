import { sql } from "drizzle-orm";
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
import { emailAddresses } from "./email.schema";

const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const agentPrincipals = sqliteTable(
  "agent_principals",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull().default(nowMs),
    revokedAt: integer("revoked_at"),
  },
  table => [
    uniqueIndex("agent_principals_org_id_uidx").on(
      table.organizationId,
      table.id
    ),
    index("agent_principals_org_created_idx").on(
      table.organizationId,
      table.createdAt,
      table.id
    ),
  ]
);

export const agentEnrollments = sqliteTable(
  "agent_enrollments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    name: text("name").notNull(),
    inboxLimit: integer("inbox_limit").notNull(),
    credentialExpiresInDays: integer("credential_expires_in_days").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(nowMs),
    expiresAt: integer("expires_at").notNull(),
    consumedAt: integer("consumed_at"),
    consumedByPrincipalId: text("consumed_by_principal_id"),
    revokedAt: integer("revoked_at"),
  },
  table => [
    uniqueIndex("agent_enrollments_org_id_uidx").on(
      table.organizationId,
      table.id
    ),
    uniqueIndex("agent_enrollments_org_token_hash_uidx").on(
      table.organizationId,
      table.tokenHash
    ),
    index("agent_enrollments_org_created_idx").on(
      table.organizationId,
      table.createdAt,
      table.id
    ),
    foreignKey({
      columns: [table.organizationId, table.consumedByPrincipalId],
      foreignColumns: [agentPrincipals.organizationId, agentPrincipals.id],
    }),
  ]
);

export const agentEnrollmentCapabilities = sqliteTable(
  "agent_enrollment_capabilities",
  {
    organizationId: text("organization_id").notNull(),
    enrollmentId: text("enrollment_id").notNull(),
    capability: text("capability").notNull(),
  },
  table => [
    primaryKey({
      columns: [table.organizationId, table.enrollmentId, table.capability],
    }),
    foreignKey({
      columns: [table.organizationId, table.enrollmentId],
      foreignColumns: [agentEnrollments.organizationId, agentEnrollments.id],
    }).onDelete("cascade"),
  ]
);

export const agentCredentials = sqliteTable(
  "agent_credentials",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    principalId: text("principal_id").notNull(),
    secretHash: text("secret_hash").notNull(),
    name: text("name").notNull(),
    inboxLimit: integer("inbox_limit").notNull().default(1),
    createdAt: integer("created_at").notNull().default(nowMs),
    expiresAt: integer("expires_at").notNull(),
    revokedAt: integer("revoked_at"),
  },
  table => [
    uniqueIndex("agent_credentials_org_id_uidx").on(
      table.organizationId,
      table.id
    ),
    uniqueIndex("agent_credentials_org_secret_hash_uidx").on(
      table.organizationId,
      table.secretHash
    ),
    foreignKey({
      columns: [table.organizationId, table.principalId],
      foreignColumns: [agentPrincipals.organizationId, agentPrincipals.id],
    }).onDelete("cascade"),
    index("agent_credentials_org_principal_idx").on(
      table.organizationId,
      table.principalId,
      table.createdAt
    ),
  ]
);

export const agentInboxes = sqliteTable(
  "agent_inboxes",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    principalId: text("principal_id").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
    deletedAt: integer("deleted_at"),
  },
  table => [
    uniqueIndex("agent_inboxes_org_id_uidx").on(table.organizationId, table.id),
    foreignKey({
      columns: [table.organizationId, table.id],
      foreignColumns: [emailAddresses.organizationId, emailAddresses.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.organizationId, table.principalId],
      foreignColumns: [agentPrincipals.organizationId, agentPrincipals.id],
    }).onDelete("cascade"),
    index("agent_inboxes_org_principal_created_idx").on(
      table.organizationId,
      table.principalId,
      table.createdAt,
      table.id
    ),
  ]
);

export const agentAddressTombstones = sqliteTable(
  "agent_address_tombstones",
  {
    address: text("address").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    inboxId: text("inbox_id").notNull(),
    deletedAt: integer("deleted_at").notNull(),
  },
  table => [
    uniqueIndex("agent_address_tombstones_org_address_uidx").on(
      table.organizationId,
      table.address
    ),
  ]
);

export const agentThreads = sqliteTable(
  "agent_threads",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    inboxId: text("inbox_id").notNull(),
    subject: text("subject"),
    messageCount: integer("message_count").notNull().default(0),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  table => [
    uniqueIndex("agent_threads_org_id_uidx").on(table.organizationId, table.id),
    foreignKey({
      columns: [table.organizationId, table.inboxId],
      foreignColumns: [agentInboxes.organizationId, agentInboxes.id],
    }).onDelete("cascade"),
    index("agent_threads_org_inbox_updated_idx").on(
      table.organizationId,
      table.inboxId,
      table.updatedAt,
      table.id
    ),
  ]
);

export const agentEvents = sqliteTable(
  "agent_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    inboxId: text("inbox_id"),
    type: text("type").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    dataJson: text("data_json").notNull().default("{}"),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  table => [
    uniqueIndex("agent_events_org_id_uidx").on(table.organizationId, table.id),
    uniqueIndex("agent_events_org_type_resource_uidx").on(
      table.organizationId,
      table.type,
      table.resourceType,
      table.resourceId
    ),
    index("agent_events_org_created_idx").on(
      table.organizationId,
      table.createdAt,
      table.id
    ),
  ]
);

export const agentEventOutbox = sqliteTable(
  "agent_event_outbox",
  {
    eventId: text("event_id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    state: text("state", { enum: ["pending", "published", "acknowledged"] })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: integer("available_at").notNull().default(nowMs),
    publishedAt: integer("published_at"),
    acknowledgedAt: integer("acknowledged_at"),
    lastError: text("last_error"),
  },
  table => [
    foreignKey({
      columns: [table.organizationId, table.eventId],
      foreignColumns: [agentEvents.organizationId, agentEvents.id],
    }).onDelete("cascade"),
    index("agent_event_outbox_state_available_idx").on(
      table.state,
      table.availableAt,
      table.eventId
    ),
  ]
);

export const agentSendingPolicies = sqliteTable("agent_sending_policies", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  sendingEnabled: integer("sending_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  suspendedAt: integer("suspended_at"),
  suspensionReason: text("suspension_reason"),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: integer("updated_at").notNull().default(nowMs),
});

export const agentRecipientRules = sqliteTable(
  "agent_recipient_rules",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["address", "domain"] }).notNull(),
    value: text("value").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  table => [
    uniqueIndex("agent_recipient_rules_org_kind_value_uidx").on(
      table.organizationId,
      table.kind,
      table.value
    ),
    index("agent_recipient_rules_org_idx").on(table.organizationId),
  ]
);

export const agentSuppressions = sqliteTable(
  "agent_suppressions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recipient: text("recipient").notNull(),
    reason: text("reason", {
      enum: ["hard_bounce", "complaint", "manual"],
    }).notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  table => [
    uniqueIndex("agent_suppressions_org_recipient_uidx").on(
      table.organizationId,
      table.recipient
    ),
  ]
);

export const agentFleetControls = sqliteTable("agent_fleet_controls", {
  id: text("id").primaryKey(),
  sendingEnabled: integer("sending_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: integer("updated_at").notNull().default(nowMs),
});

export const agentSendingDomains = sqliteTable(
  "agent_sending_domains",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    providerReady: integer("provider_ready", { mode: "boolean" })
      .notNull()
      .default(false),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  table => [primaryKey({ columns: [table.organizationId, table.domain] })]
);

export const agentPilotEntitlements = sqliteTable("agent_pilot_entitlements", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["inactive", "pilot"] })
    .notNull()
    .default("inactive"),
  monthlyRecipientLimit: integer("monthly_recipient_limit")
    .notNull()
    .default(1000),
  storageByteLimit: integer("storage_byte_limit")
    .notNull()
    .default(1_073_741_824),
  assignedByUserId: text("assigned_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: integer("updated_at").notNull().default(nowMs),
});

export const agentUsage = sqliteTable(
  "agent_usage",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    reservedRecipients: integer("reserved_recipients").notNull().default(0),
    submittedRecipients: integer("submitted_recipients").notNull().default(0),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  table => [primaryKey({ columns: [table.organizationId, table.period] })]
);

export const agentDrafts = sqliteTable(
  "agent_drafts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    inboxId: text("inbox_id").notNull(),
    threadId: text("thread_id"),
    createdByPrincipalId: text("created_by_principal_id"),
    toJson: text("to_json").notNull(),
    ccJson: text("cc_json").notNull().default("[]"),
    bccJson: text("bcc_json").notNull().default("[]"),
    subject: text("subject").notNull().default(""),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    inReplyTo: text("in_reply_to"),
    referencesJson: text("references_json").notNull().default("[]"),
    version: integer("version").notNull().default(1),
    contentHash: text("content_hash").notNull(),
    approvedHash: text("approved_hash"),
    approvedByUserId: text("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: integer("approved_at"),
    submittedAt: integer("submitted_at"),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  table => [
    uniqueIndex("agent_drafts_org_id_uidx").on(table.organizationId, table.id),
    foreignKey({
      columns: [table.organizationId, table.inboxId],
      foreignColumns: [agentInboxes.organizationId, agentInboxes.id],
    }).onDelete("cascade"),
    index("agent_drafts_org_inbox_updated_idx").on(
      table.organizationId,
      table.inboxId,
      table.updatedAt,
      table.id
    ),
  ]
);

export const agentSubmissions = sqliteTable(
  "agent_submissions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    draftId: text("draft_id").notNull(),
    credentialId: text("credential_id").notNull(),
    state: text("state", {
      enum: ["queued", "submitting", "submitted", "uncertain", "failed"],
    })
      .notNull()
      .default("queued"),
    providerMessageId: text("provider_message_id"),
    recipientCount: integer("recipient_count").notNull(),
    usagePeriod: text("usage_period").notNull(),
    failureCode: text("failure_code"),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  table => [
    uniqueIndex("agent_submissions_org_id_uidx").on(
      table.organizationId,
      table.id
    ),
    uniqueIndex("agent_submissions_org_draft_uidx").on(
      table.organizationId,
      table.draftId
    ),
    foreignKey({
      columns: [table.organizationId, table.draftId],
      foreignColumns: [agentDrafts.organizationId, agentDrafts.id],
    }),
    foreignKey({
      columns: [table.organizationId, table.credentialId],
      foreignColumns: [agentCredentials.organizationId, agentCredentials.id],
    }),
    index("agent_submissions_state_updated_idx").on(
      table.state,
      table.updatedAt,
      table.id
    ),
  ]
);

export const agentRecipientOutcomes = sqliteTable(
  "agent_recipient_outcomes",
  {
    organizationId: text("organization_id").notNull(),
    submissionId: text("submission_id").notNull(),
    recipient: text("recipient").notNull(),
    state: text("state").notNull().default("queued"),
    providerEventId: text("provider_event_id"),
    occurredAt: integer("occurred_at"),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  table => [
    primaryKey({
      columns: [table.organizationId, table.submissionId, table.recipient],
    }),
    foreignKey({
      columns: [table.organizationId, table.submissionId],
      foreignColumns: [agentSubmissions.organizationId, agentSubmissions.id],
    }).onDelete("cascade"),
  ]
);

export const agentProviderEvents = sqliteTable(
  "agent_provider_events",
  {
    organizationId: text("organization_id").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    submissionId: text("submission_id").notNull(),
    recipient: text("recipient").notNull(),
    status: text("status").notNull(),
    occurredAt: integer("occurred_at").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  table => [
    primaryKey({ columns: [table.organizationId, table.providerEventId] }),
    foreignKey({
      columns: [table.organizationId, table.submissionId],
      foreignColumns: [agentSubmissions.organizationId, agentSubmissions.id],
    }).onDelete("cascade"),
    index("agent_provider_events_org_status_occurred_idx").on(
      table.organizationId,
      table.status,
      table.occurredAt
    ),
  ]
);

export const agentCredentialCapabilities = sqliteTable(
  "agent_credential_capabilities",
  {
    organizationId: text("organization_id").notNull(),
    credentialId: text("credential_id").notNull(),
    capability: text("capability").notNull(),
  },
  table => [
    primaryKey({
      columns: [table.organizationId, table.credentialId, table.capability],
    }),
    foreignKey({
      columns: [table.organizationId, table.credentialId],
      foreignColumns: [agentCredentials.organizationId, agentCredentials.id],
    }).onDelete("cascade"),
  ]
);

export const agentInboxGrants = sqliteTable(
  "agent_inbox_grants",
  {
    organizationId: text("organization_id").notNull(),
    credentialId: text("credential_id").notNull(),
    inboxId: text("inbox_id").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  table => [
    primaryKey({
      columns: [table.organizationId, table.credentialId, table.inboxId],
    }),
    foreignKey({
      columns: [table.organizationId, table.credentialId],
      foreignColumns: [agentCredentials.organizationId, agentCredentials.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.organizationId, table.inboxId],
      foreignColumns: [emailAddresses.organizationId, emailAddresses.id],
    }).onDelete("cascade"),
  ]
);

export const agentIdempotencyKeys = sqliteTable(
  "agent_idempotency_keys",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    operation: text("operation").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    state: text("state", { enum: ["pending", "complete"] })
      .notNull()
      .default("pending"),
    resultType: text("result_type"),
    resultId: text("result_id"),
    responseJson: text("response_json"),
    createdAt: integer("created_at").notNull().default(nowMs),
    completedAt: integer("completed_at"),
  },
  table => [
    uniqueIndex("agent_idempotency_scope_key_uidx").on(
      table.organizationId,
      table.actorId,
      table.operation,
      table.key
    ),
    index("agent_idempotency_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
  ]
);

export const agentAudit = sqliteTable(
  "agent_audit",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorType: text("actor_type", {
      enum: ["human", "agent", "system"],
    }).notNull(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    requestId: text("request_id").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  table => [
    index("agent_audit_org_created_idx").on(
      table.organizationId,
      table.createdAt,
      table.id
    ),
  ]
);
