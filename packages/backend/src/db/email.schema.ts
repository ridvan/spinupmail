import { relations, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { organizations, users } from "./auth.schema";

export const emailAddresses = sqliteTable(
  "email_addresses",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    address: text("address").notNull().unique(),
    localPart: text("local_part").notNull(),
    domain: text("domain").notNull(),
    meta: text("meta"),
    emailCount: integer("email_count").default(0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    autoCreated: integer("auto_created", { mode: "boolean" })
      .default(false)
      .notNull(),
    lastReceivedAt: integer("last_received_at", { mode: "timestamp_ms" }),
  },
  table => [
    index("email_addresses_domain_idx").on(table.domain),
    index("email_addresses_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    index("email_addresses_org_user_created_idx").on(
      table.organizationId,
      table.userId,
      table.createdAt
    ),
  ]
);

export const emails = sqliteTable(
  "emails",
  {
    id: text("id").primaryKey(),
    addressId: text("address_id")
      .notNull()
      .references(() => emailAddresses.id, { onDelete: "cascade" }),
    messageId: text("message_id"),
    sender: text("sender"),
    from: text("from").notNull(),
    to: text("to").notNull(),
    subject: text("subject"),
    headers: text("headers"),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    raw: text("raw"),
    rawSize: integer("raw_size"),
    rawTruncated: integer("raw_truncated", { mode: "boolean" })
      .default(false)
      .notNull(),
    receivedAt: integer("received_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  table => [
    index("emails_address_received_idx").on(table.addressId, table.receivedAt),
    uniqueIndex("emails_address_message_id_unique").on(
      table.addressId,
      table.messageId
    ),
  ]
);

export const emailAttachments = sqliteTable(
  "email_attachments",
  {
    id: text("id").primaryKey(),
    emailId: text("email_id")
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    addressId: text("address_id")
      .notNull()
      .references(() => emailAddresses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    r2Key: text("r2_key").notNull().unique(),
    disposition: text("disposition"),
    contentId: text("content_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  table => [
    index("email_attachments_org_email_created_idx").on(
      table.organizationId,
      table.emailId,
      table.createdAt
    ),
    index("email_attachments_org_address_created_idx").on(
      table.organizationId,
      table.addressId,
      table.createdAt
    ),
  ]
);

export const emailAddressesRelations = relations(
  emailAddresses,
  ({ many }) => ({
    emails: many(emails),
    attachments: many(emailAttachments),
  })
);

export const emailAddressesUserRelations = relations(
  emailAddresses,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [emailAddresses.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [emailAddresses.userId],
      references: [users.id],
    }),
  })
);

export const emailsRelations = relations(emails, ({ one, many }) => ({
  address: one(emailAddresses, {
    fields: [emails.addressId],
    references: [emailAddresses.id],
  }),
  attachments: many(emailAttachments),
}));

export const emailAttachmentsRelations = relations(
  emailAttachments,
  ({ one }) => ({
    email: one(emails, {
      fields: [emailAttachments.emailId],
      references: [emails.id],
    }),
    address: one(emailAddresses, {
      fields: [emailAttachments.addressId],
      references: [emailAddresses.id],
    }),
    organization: one(organizations, {
      fields: [emailAttachments.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [emailAttachments.userId],
      references: [users.id],
    }),
  })
);
