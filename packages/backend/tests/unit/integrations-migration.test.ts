import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const migrationsDir = path.resolve(process.cwd(), "drizzle");

const applyMigrationFile = (db: DatabaseSync, filename: string) => {
  const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map(statement => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    db.exec(statement);
  }
};

const createPre0009Schema = (db: DatabaseSync) => {
  db.exec(`
    CREATE TABLE users (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      email_verified integer DEFAULT false NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );

    CREATE TABLE organizations (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      created_at integer NOT NULL
    );

    CREATE TABLE email_addresses (
      id text PRIMARY KEY NOT NULL,
      organization_id text,
      user_id text NOT NULL,
      address text NOT NULL UNIQUE,
      local_part text NOT NULL,
      domain text NOT NULL,
      email_count integer DEFAULT 0 NOT NULL,
      created_at integer NOT NULL,
      auto_created integer DEFAULT false NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE cascade,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade
    );
    CREATE UNIQUE INDEX email_addresses_org_id_uidx
      ON email_addresses (organization_id, id);

    CREATE TABLE emails (
      id text PRIMARY KEY NOT NULL,
      address_id text NOT NULL,
      "from" text NOT NULL,
      "to" text NOT NULL,
      raw_truncated integer DEFAULT false NOT NULL,
      is_sample integer DEFAULT false NOT NULL,
      received_at integer NOT NULL,
      FOREIGN KEY (address_id) REFERENCES email_addresses(id) ON DELETE cascade
    );

    CREATE TABLE organization_integrations (
      id text PRIMARY KEY NOT NULL,
      organization_id text NOT NULL,
      provider text NOT NULL,
      name text NOT NULL,
      status text NOT NULL,
      created_by_user_id text NOT NULL,
      public_config_json text NOT NULL,
      active_secret_version integer NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE cascade,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE cascade
    );
    CREATE UNIQUE INDEX organization_integrations_org_id_uidx
      ON organization_integrations (organization_id, id);

    CREATE TABLE address_integration_subscriptions (
      id text PRIMARY KEY NOT NULL,
      organization_id text NOT NULL,
      address_id text NOT NULL,
      integration_id text NOT NULL,
      event_type text NOT NULL,
      enabled integer DEFAULT true NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE cascade,
      FOREIGN KEY (organization_id, address_id)
        REFERENCES email_addresses(organization_id, id) ON DELETE cascade,
      FOREIGN KEY (organization_id, integration_id)
        REFERENCES organization_integrations(organization_id, id) ON DELETE cascade
    );
    CREATE UNIQUE INDEX address_integration_subscriptions_org_id_uidx
      ON address_integration_subscriptions (organization_id, id);

    CREATE TABLE integration_dispatches (
      id text PRIMARY KEY NOT NULL,
      organization_id text NOT NULL,
      integration_id text NOT NULL,
      subscription_id text NOT NULL,
      provider text NOT NULL,
      event_type text NOT NULL,
      source_email_id text NOT NULL,
      payload_json text NOT NULL,
      idempotency_key text NOT NULL,
      status text NOT NULL,
      attempt_count integer DEFAULT 0 NOT NULL,
      max_attempt_window_ms integer NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE cascade,
      FOREIGN KEY (source_email_id) REFERENCES emails(id) ON DELETE cascade,
      FOREIGN KEY (organization_id, integration_id)
        REFERENCES organization_integrations(organization_id, id) ON DELETE cascade,
      FOREIGN KEY (organization_id, subscription_id)
        REFERENCES address_integration_subscriptions(organization_id, id) ON DELETE cascade
    );
    CREATE UNIQUE INDEX integration_dispatches_org_id_uidx
      ON integration_dispatches (organization_id, id);

    CREATE TABLE integration_delivery_attempts (
      id text PRIMARY KEY NOT NULL,
      dispatch_id text NOT NULL,
      organization_id text NOT NULL,
      integration_id text NOT NULL,
      attempt_number integer NOT NULL,
      outcome text NOT NULL,
      error text,
      error_code text,
      error_status integer,
      error_retry_after_seconds integer,
      started_at integer NOT NULL,
      completed_at integer,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE cascade,
      FOREIGN KEY (organization_id, dispatch_id)
        REFERENCES integration_dispatches(organization_id, id) ON DELETE cascade,
      FOREIGN KEY (organization_id, integration_id)
        REFERENCES organization_integrations(organization_id, id) ON DELETE cascade
    );
    CREATE UNIQUE INDEX integration_delivery_attempts_dispatch_attempt_uidx
      ON integration_delivery_attempts (dispatch_id, attempt_number);
    CREATE INDEX integration_delivery_attempts_integration_started_idx
      ON integration_delivery_attempts (integration_id, started_at);
  `);
};

describe("integrations migration", () => {
  it("preserves delivery-attempt quota history after deleting an integration", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");

    createPre0009Schema(db);

    const nowMs = Date.parse("2026-04-22T10:00:00.000Z");
    db.prepare(
      `
        INSERT INTO users (
          id, name, email, email_verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run("user-1", "User", "user@example.com", 1, nowMs, nowMs);
    db.prepare(
      `
        INSERT INTO organizations (
          id, name, slug, created_at
        ) VALUES (?, ?, ?, ?)
      `
    ).run("org-1", "Org", "org", nowMs);
    db.prepare(
      `
        INSERT INTO email_addresses (
          id, organization_id, user_id, address, local_part, domain, email_count, created_at, auto_created
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "address-1",
      "org-1",
      "user-1",
      "ops@example.com",
      "ops",
      "example.com",
      0,
      nowMs,
      0
    );
    db.prepare(
      `
        INSERT INTO emails (
          id, address_id, "from", "to", raw_truncated, is_sample, received_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "email-1",
      "address-1",
      "sender@example.com",
      "ops@example.com",
      0,
      0,
      nowMs
    );
    db.prepare(
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
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "integration-1",
      "org-1",
      "telegram",
      "Ops Bot",
      "active",
      "user-1",
      '{"telegramBotId":"101","botUsername":"spinupmail_bot","chatId":"-100123","chatLabel":"Ops Room"}',
      1,
      nowMs,
      nowMs
    );
    db.prepare(
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "subscription-1",
      "org-1",
      "address-1",
      "integration-1",
      "email.received",
      1,
      nowMs,
      nowMs
    );
    db.prepare(
      `
        INSERT INTO integration_dispatches (
          id,
          organization_id,
          integration_id,
          subscription_id,
          provider,
          event_type,
          source_email_id,
          payload_json,
          idempotency_key,
          status,
          attempt_count,
          max_attempt_window_ms,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "dispatch-1",
      "org-1",
      "integration-1",
      "subscription-1",
      "telegram",
      "email.received",
      "email-1",
      '{"eventId":"event-1"}',
      "idempotency-key-1",
      "sent",
      1,
      86_400_000,
      nowMs,
      nowMs
    );
    db.prepare(
      `
        INSERT INTO integration_delivery_attempts (
          id,
          dispatch_id,
          organization_id,
          integration_id,
          attempt_number,
          outcome,
          started_at,
          completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "attempt-1",
      "dispatch-1",
      "org-1",
      "integration-1",
      1,
      "sent",
      nowMs,
      nowMs
    );

    applyMigrationFile(db, "0009_tranquil_roulette.sql");

    const countBeforeDelete = db
      .prepare("SELECT count(*) AS count FROM integration_delivery_attempts")
      .get() as { count: number };
    expect(countBeforeDelete.count).toBe(1);

    db.prepare("DELETE FROM organization_integrations WHERE id = ?").run(
      "integration-1"
    );

    const dispatchCount = db
      .prepare("SELECT count(*) AS count FROM integration_dispatches")
      .get() as { count: number };
    const attemptCountAfterIntegrationDelete = db
      .prepare("SELECT count(*) AS count FROM integration_delivery_attempts")
      .get() as { count: number };

    expect(dispatchCount.count).toBe(0);
    expect(attemptCountAfterIntegrationDelete.count).toBe(1);

    db.prepare("DELETE FROM organizations WHERE id = ?").run("org-1");

    const attemptCountAfterOrganizationDelete = db
      .prepare("SELECT count(*) AS count FROM integration_delivery_attempts")
      .get() as { count: number };
    expect(attemptCountAfterOrganizationDelete.count).toBe(0);

    db.close();
  });
});
