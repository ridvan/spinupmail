import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { hashForRateLimitKey } from "@/shared/utils/crypto";

/** Real SQLite constraints and transactions behind a small D1-compatible facade. */
export const createAgentTestDb = () => {
  const sqlite = new DatabaseSync(":memory:");
  const directory = path.resolve(process.cwd(), "drizzle");
  for (const file of readdirSync(directory)
    .filter(name => name.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(path.join(directory, file), "utf8"));
  }
  sqlite.exec("PRAGMA foreign_keys = ON");

  const prepare = (query: string, values: SQLInputValue[] = []) => {
    const execute = () => {
      const statement = sqlite.prepare(query);
      if (statement.columns().length > 0) {
        return {
          success: true,
          results: statement.all(...values),
          meta: { changes: 0 },
        };
      }
      const result = statement.run(...values);
      return {
        success: true,
        results: [],
        meta: {
          changes: Number(result.changes),
          last_row_id: Number(result.lastInsertRowid),
        },
      };
    };
    return {
      bind: (...args: SQLInputValue[]) => prepare(query, args),
      first: async (column?: string) => {
        const row = sqlite.prepare(query).get(...values);
        return column ? (row?.[column] ?? null) : (row ?? null);
      },
      all: async () => execute(),
      run: async () => execute(),
      raw: async () =>
        sqlite
          .prepare(query)
          .all(...values)
          .map(row => Object.values(row)),
      execute,
    };
  };

  const db = {
    prepare,
    batch: async (statements: ReturnType<typeof prepare>[]) => {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map(statement => statement.execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;

  const seedOrganization = (
    organizationId = "org-a",
    userId = "user-a",
    options: { twoFactor?: boolean; role?: string } = {}
  ) => {
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO users
        (id, name, email, email_verified, two_factor_enabled, created_at, updated_at)
        VALUES (?, 'Test Owner', ?, 1, ?, ?, ?)`
      )
      .run(
        userId,
        `${userId}@example.com`,
        options.twoFactor === false ? 0 : 1,
        now,
        now
      );
    sqlite
      .prepare(
        "INSERT INTO organizations (id, name, slug, created_at) VALUES (?, 'Example Team', ?, ?)"
      )
      .run(organizationId, organizationId, now);
    sqlite
      .prepare(
        `INSERT INTO members
        (id, organization_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        crypto.randomUUID(),
        organizationId,
        userId,
        options.role ?? "owner",
        now
      );
  };

  const seedAgent = async (
    options: {
      organizationId?: string;
      userId?: string;
      address?: string;
      capabilities?: string[];
      inboxLimit?: number;
    } = {}
  ) => {
    const organizationId = options.organizationId ?? "org-a";
    const userId = options.userId ?? "user-a";
    const address =
      options.address ?? `agent-${crypto.randomUUID()}@example.com`;
    const [localPart, domain] = address.split("@");
    const principalId = crypto.randomUUID();
    const credentialId = crypto.randomUUID();
    const inboxId = crypto.randomUUID();
    const secret = "z".repeat(43);
    const now = Date.now();
    sqlite
      .prepare(
        `INSERT INTO agent_principals
        (id, organization_id, name, created_by_user_id, created_at)
        VALUES (?, ?, 'Fixture agent', ?, ?)`
      )
      .run(principalId, organizationId, userId, now);
    sqlite
      .prepare(
        `INSERT INTO agent_credentials
        (id, organization_id, principal_id, secret_hash, name, inbox_limit, created_at, expires_at)
        VALUES (?, ?, ?, ?, 'Fixture credential', ?, ?, ?)`
      )
      .run(
        credentialId,
        organizationId,
        principalId,
        await hashForRateLimitKey(secret),
        options.inboxLimit ?? 5,
        now,
        now + 86_400_000
      );
    for (const capability of options.capabilities ?? [
      "inboxes:create",
      "inboxes:read",
      "inboxes:delete",
      "messages:read",
      "events:read",
    ]) {
      sqlite
        .prepare(
          `INSERT INTO agent_credential_capabilities
          (organization_id, credential_id, capability) VALUES (?, ?, ?)`
        )
        .run(organizationId, credentialId, capability);
    }
    sqlite
      .prepare(
        `INSERT INTO email_addresses
        (id, organization_id, user_id, address, local_part, domain, meta, created_at)
        VALUES (?, ?, ?, ?, ?, ?, '{"agentPersistent":true}', ?)`
      )
      .run(inboxId, organizationId, userId, address, localPart, domain, now);
    sqlite
      .prepare(
        `INSERT INTO agent_inboxes
        (id, organization_id, principal_id, created_at) VALUES (?, ?, ?, ?)`
      )
      .run(inboxId, organizationId, principalId, now);
    sqlite
      .prepare(
        `INSERT INTO agent_inbox_grants
        (organization_id, credential_id, inbox_id, created_at) VALUES (?, ?, ?, ?)`
      )
      .run(organizationId, credentialId, inboxId, now);
    return {
      organizationId,
      userId,
      principalId,
      credentialId,
      inboxId,
      address,
      token: `smai_v1_${credentialId}.${secret}`,
    };
  };

  const enableAgentSending = (
    options: {
      organizationId?: string;
      userId?: string;
      domain?: string;
      monthlyRecipientLimit?: number;
      allowedRecipients?: string[];
      allowedDomains?: string[];
    } = {}
  ) => {
    const organizationId = options.organizationId ?? "org-a";
    const userId = options.userId ?? "user-a";
    const domain = options.domain ?? "example.com";
    const now = Date.now();
    sqlite
      .prepare(
        "UPDATE agent_fleet_controls SET sending_enabled = 1, updated_at = ? WHERE id = 'outbound'"
      )
      .run(now);
    sqlite
      .prepare(
        `INSERT INTO agent_sending_policies
        (organization_id, sending_enabled, updated_by_user_id, updated_at)
        VALUES (?, 1, ?, ?)`
      )
      .run(organizationId, userId, now);
    sqlite
      .prepare(
        `INSERT INTO agent_pilot_entitlements
        (organization_id, status, monthly_recipient_limit, assigned_by_user_id, updated_at)
        VALUES (?, 'pilot', ?, ?, ?)`
      )
      .run(organizationId, options.monthlyRecipientLimit ?? 1000, userId, now);
    sqlite
      .prepare(
        `INSERT INTO agent_sending_domains
        (organization_id, domain, enabled, provider_ready, updated_at)
        VALUES (?, ?, 1, 1, ?)`
      )
      .run(organizationId, domain, now);
    for (const recipient of options.allowedRecipients ?? []) {
      sqlite
        .prepare(
          `INSERT INTO agent_recipient_rules
          (id, organization_id, kind, value, created_by_user_id, created_at)
          VALUES (?, ?, 'address', ?, ?, ?)`
        )
        .run(crypto.randomUUID(), organizationId, recipient, userId, now);
    }
    for (const allowedDomain of options.allowedDomains ?? []) {
      sqlite
        .prepare(
          `INSERT INTO agent_recipient_rules
          (id, organization_id, kind, value, created_by_user_id, created_at)
          VALUES (?, ?, 'domain', ?, ?, ?)`
        )
        .run(crypto.randomUUID(), organizationId, allowedDomain, userId, now);
    }
  };

  return {
    db,
    sqlite,
    seedOrganization,
    seedAgent,
    enableAgentSending,
    close: () => sqlite.close(),
  };
};
