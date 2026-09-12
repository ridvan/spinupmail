import { agentFleetControlRequestSchema } from "@spinupmail/contracts";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import {
  auditStatement,
  jsonInput,
  requestIdFor,
  requirePlatformOperator,
} from "./core";

const readControl = async (db: D1Database) => {
  const row = await db
    .prepare(
      `SELECT sending_enabled AS sendingEnabled,
      updated_by_user_id AS updatedByUserId, updated_at AS updatedAt
      FROM agent_fleet_controls WHERE id = 'outbound'`
    )
    .first();
  return {
    control: row ?? {
      sendingEnabled: false,
      updatedByUserId: null,
      updatedAt: null,
    },
  };
};

export const createAgentOperatorRouter = () => {
  const router = new Hono<AppHonoEnv>();
  router.use("/operator/*", async (c, next) => {
    requirePlatformOperator(c.get("agentActor"));
    await next();
  });
  router.get("/operator/fleet", c =>
    readControl(c.env.SUM_DB).then(value => c.json(value))
  );
  router.put("/operator/fleet", async c => {
    const actor = c.get("agentActor");
    const input = await jsonInput(c, agentFleetControlRequestSchema);
    const now = Date.now();
    await c.env.SUM_DB.batch([
      c.env.SUM_DB.prepare(
        `INSERT INTO agent_fleet_controls
        (id, sending_enabled, updated_by_user_id, updated_at)
        VALUES ('outbound', ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET sending_enabled = excluded.sending_enabled,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = excluded.updated_at`
      ).bind(input.sendingEnabled ? 1 : 0, actor.id, now),
      auditStatement(
        c.env.SUM_DB,
        actor,
        requestIdFor(c),
        "fleet_control.updated",
        "fleet_control",
        "outbound",
        { sendingEnabled: input.sendingEnabled }
      ),
    ]);
    return c.json({
      control: {
        sendingEnabled: input.sendingEnabled,
        updatedByUserId: actor.id,
        updatedAt: now,
      },
    });
  });
  return router;
};
