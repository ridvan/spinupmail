import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { requireHumanAdmin } from "./core";

export const createAgentUsageRouter = () => {
  const router = new Hono<AppHonoEnv>();
  router.get("/usage", async c => {
    const actor = c.get("agentActor");
    requireHumanAdmin(actor);
    const period = new Date().toISOString().slice(0, 7);
    const [usage, entitlement] = await c.env.SUM_DB.batch([
      c.env.SUM_DB.prepare(
        `SELECT period, reserved_recipients AS reservedRecipients,
        submitted_recipients AS submittedRecipients, updated_at AS updatedAt
        FROM agent_usage WHERE organization_id = ? AND period = ?`
      ).bind(actor.organizationId, period),
      c.env.SUM_DB.prepare(
        `SELECT status, monthly_recipient_limit AS monthlyRecipientLimit,
        storage_byte_limit AS storageByteLimit, updated_at AS updatedAt
        FROM agent_pilot_entitlements WHERE organization_id = ?`
      ).bind(actor.organizationId),
    ]);
    return c.json({
      usage: usage.results[0] ?? {
        period,
        reservedRecipients: 0,
        submittedRecipients: 0,
        updatedAt: null,
      },
      entitlement: entitlement.results[0] ?? {
        status: "inactive",
        monthlyRecipientLimit: 0,
        storageByteLimit: 0,
        updatedAt: null,
      },
    });
  });
  return router;
};
