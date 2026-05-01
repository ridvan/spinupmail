import { desc, relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { emailAddresses, emails } from "./email.schema";
import {
  integrationDispatches,
  organizationIntegrations,
} from "./integration.schema";
import { organizations } from "./auth.schema";

export const operationalEvents = sqliteTable(
  "operational_events",
  {
    id: text("id").primaryKey(),
    severity: text("severity").notNull(),
    type: text("type").notNull(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    addressId: text("address_id").references(() => emailAddresses.id, {
      onDelete: "set null",
    }),
    emailId: text("email_id").references(() => emails.id, {
      onDelete: "set null",
    }),
    integrationId: text("integration_id").references(
      () => organizationIntegrations.id,
      { onDelete: "set null" }
    ),
    dispatchId: text("dispatch_id").references(() => integrationDispatches.id, {
      onDelete: "set null",
    }),
    message: text("message").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  table => [
    index("operational_events_created_idx").on(desc(table.createdAt)),
    index("operational_events_severity_created_idx").on(
      table.severity,
      desc(table.createdAt)
    ),
    index("operational_events_type_created_idx").on(
      table.type,
      desc(table.createdAt)
    ),
    index("operational_events_org_created_idx").on(
      table.organizationId,
      desc(table.createdAt)
    ),
    index("operational_events_org_severity_type_created_idx").on(
      table.organizationId,
      table.severity,
      table.type,
      desc(table.createdAt)
    ),
  ]
);

export const operationalEventsRelations = relations(
  operationalEvents,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [operationalEvents.organizationId],
      references: [organizations.id],
    }),
    address: one(emailAddresses, {
      fields: [operationalEvents.addressId],
      references: [emailAddresses.id],
    }),
    email: one(emails, {
      fields: [operationalEvents.emailId],
      references: [emails.id],
    }),
    integration: one(organizationIntegrations, {
      fields: [operationalEvents.integrationId],
      references: [organizationIntegrations.id],
    }),
    dispatch: one(integrationDispatches, {
      fields: [operationalEvents.dispatchId],
      references: [integrationDispatches.id],
    }),
  })
);
