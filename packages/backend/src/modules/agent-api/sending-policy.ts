import { agentSendingPolicyRequestSchema } from "@spinupmail/contracts";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { parseBooleanEnv } from "@/shared/env";
import {
  AgentError,
  auditStatement,
  jsonInput,
  requestIdFor,
  requireHumanAdmin,
} from "./core";

const recipientDomain = (recipient: string) =>
  recipient.slice(recipient.lastIndexOf("@") + 1);

export const assertSendingGates = async (args: {
  db: D1Database;
  env: CloudflareBindings;
  organizationId: string;
  sendingDomain: string;
  recipients: string[];
  contentHash: string;
  approvedHash: string | null;
}) => {
  if (!parseBooleanEnv(args.env.AGENT_OUTBOUND_ENABLED, false)) {
    throw new AgentError(
      "fleet_disabled",
      "Agent outbound sending is disabled",
      503
    );
  }
  const [fleet, policy, entitlement, domain, rules, suppressions] =
    await args.db.batch([
      args.db.prepare(
        "SELECT sending_enabled FROM agent_fleet_controls WHERE id = 'outbound'"
      ),
      args.db
        .prepare(
          `SELECT sending_enabled, suspended_at FROM agent_sending_policies
      WHERE organization_id = ?`
        )
        .bind(args.organizationId),
      args.db
        .prepare(
          `SELECT status, monthly_recipient_limit FROM agent_pilot_entitlements
      WHERE organization_id = ?`
        )
        .bind(args.organizationId),
      args.db
        .prepare(
          `SELECT enabled, provider_ready FROM agent_sending_domains
      WHERE organization_id = ? AND domain = ?`
        )
        .bind(args.organizationId, args.sendingDomain),
      args.db
        .prepare(
          `SELECT kind, value FROM agent_recipient_rules WHERE organization_id = ?`
        )
        .bind(args.organizationId),
      args.db
        .prepare(
          `SELECT recipient FROM agent_suppressions WHERE organization_id = ?`
        )
        .bind(args.organizationId),
    ]);
  const fleetRow = fleet.results[0] as { sending_enabled?: number } | undefined;
  const policyRow = policy.results[0] as
    { sending_enabled?: number; suspended_at?: number | null } | undefined;
  const entitlementRow = entitlement.results[0] as
    { status?: string; monthly_recipient_limit?: number } | undefined;
  const domainRow = domain.results[0] as
    { enabled?: number; provider_ready?: number } | undefined;
  if (fleetRow?.sending_enabled !== 1) {
    throw new AgentError(
      "fleet_disabled",
      "Agent outbound fleet switch is off",
      503
    );
  }
  if (policyRow?.suspended_at) {
    throw new AgentError(
      "workspace_suspended",
      "Workspace sending is suspended",
      403
    );
  }
  if (policyRow?.sending_enabled !== 1) {
    throw new AgentError(
      "workspace_disabled",
      "Workspace sending is disabled",
      403
    );
  }
  if (entitlementRow?.status !== "pilot") {
    throw new AgentError(
      "entitlement_required",
      "Pilot entitlement is required",
      403
    );
  }
  if (domainRow?.enabled !== 1 || domainRow.provider_ready !== 1) {
    throw new AgentError(
      "domain_disabled",
      "Sending domain is not provider-ready",
      403
    );
  }
  const suppressed = new Set(
    suppressions.results.map(row => (row as { recipient: string }).recipient)
  );
  if (args.recipients.some(recipient => suppressed.has(recipient))) {
    throw new AgentError(
      "recipient_suppressed",
      "A recipient is suppressed",
      403
    );
  }
  const allowedAddresses = new Set<string>();
  const allowedDomains = new Set<string>();
  for (const row of rules.results as Array<{ kind: string; value: string }>) {
    if (row.kind === "address") allowedAddresses.add(row.value);
    if (row.kind === "domain") allowedDomains.add(row.value);
  }
  const allAllowed = args.recipients.every(
    recipient =>
      allowedAddresses.has(recipient) ||
      allowedDomains.has(recipientDomain(recipient))
  );
  if (!allAllowed && args.approvedHash !== args.contentHash) {
    throw new AgentError(
      "approval_required",
      "The exact draft requires human approval for these recipients",
      403
    );
  }
  return {
    monthlyRecipientLimit: entitlementRow.monthly_recipient_limit ?? 1000,
  };
};

export const createAgentSendingPolicyRouter = () => {
  const router = new Hono<AppHonoEnv>();
  router.get("/sending-policy", async c => {
    const actor = c.get("agentActor");
    requireHumanAdmin(actor);
    const [policy, rules] = await c.env.SUM_DB.batch([
      c.env.SUM_DB.prepare(
        `SELECT sending_enabled AS sendingEnabled, suspended_at AS suspendedAt,
        suspension_reason AS suspensionReason, updated_at AS updatedAt
        FROM agent_sending_policies WHERE organization_id = ?`
      ).bind(actor.organizationId),
      c.env.SUM_DB.prepare(
        `SELECT kind, value FROM agent_recipient_rules
        WHERE organization_id = ? ORDER BY kind, value`
      ).bind(actor.organizationId),
    ]);
    return c.json({
      policy: policy.results[0] ?? {
        sendingEnabled: false,
        suspendedAt: null,
        suspensionReason: null,
        updatedAt: null,
      },
      recipientRules: rules.results,
    });
  });

  router.put("/sending-policy", async c => {
    const actor = c.get("agentActor");
    requireHumanAdmin(actor);
    const input = await jsonInput(c, agentSendingPolicyRequestSchema);
    const now = Date.now();
    await c.env.SUM_DB.batch([
      c.env.SUM_DB.prepare(
        `INSERT INTO agent_sending_policies
        (organization_id, sending_enabled, updated_by_user_id, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (organization_id) DO UPDATE SET
          sending_enabled = excluded.sending_enabled,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at`
      ).bind(actor.organizationId, input.sendingEnabled ? 1 : 0, actor.id, now),
      c.env.SUM_DB.prepare(
        "DELETE FROM agent_recipient_rules WHERE organization_id = ?"
      ).bind(actor.organizationId),
      ...input.recipientRules.map(rule =>
        c.env.SUM_DB.prepare(
          `INSERT INTO agent_recipient_rules
          (id, organization_id, kind, value, created_by_user_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          actor.organizationId,
          rule.kind,
          rule.value.replace(/^@/, ""),
          actor.id,
          now
        )
      ),
      auditStatement(
        c.env.SUM_DB,
        actor,
        requestIdFor(c),
        "sending_policy.updated",
        "sending_policy",
        actor.organizationId,
        {
          sendingEnabled: input.sendingEnabled,
          ruleCount: input.recipientRules.length,
        }
      ),
    ]);
    return c.json({ ok: true });
  });
  return router;
};
