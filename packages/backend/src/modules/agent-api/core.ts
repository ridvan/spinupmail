import type { AgentCapability } from "@spinupmail/contracts";
import type { Context } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { hashForRateLimitKey } from "@/shared/utils/crypto";

export type AgentActor = {
  id: string;
  organizationId: string;
  kind: "human" | "agent" | "legacy";
  admin: boolean;
  twoFactorEnabled: boolean;
  platformAdmin?: boolean;
  credentialId?: string;
  capabilities: AgentCapability[];
  inboxIds: string[];
};

export type AgentContext = Context<AppHonoEnv>;

export class AgentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status:
      400 | 401 | 403 | 404 | 409 | 410 | 413 | 429 | 503 = 400
  ) {
    super(message);
  }
}

export const digestSecret = hashForRateLimitKey;

export const actorCan = (actor: AgentActor, capability: AgentCapability) =>
  actor.kind === "human" ||
  (actor.kind === "legacy"
    ? capability !== "messages:send"
    : actor.capabilities.includes(capability));

export const requireCapability = (
  actor: AgentActor,
  capability: AgentCapability
) => {
  if (!actorCan(actor, capability)) {
    throw new AgentError("forbidden", `Missing capability: ${capability}`, 403);
  }
};

export const requireHumanAdmin = (actor: AgentActor) => {
  if (actor.kind !== "human" || !actor.admin) {
    throw new AgentError(
      "forbidden",
      "A human workspace owner or administrator is required",
      403
    );
  }
};

export const requireTwoFactor = (actor: AgentActor) => {
  requireHumanAdmin(actor);
  if (!actor.twoFactorEnabled) {
    throw new AgentError(
      "two_factor_required",
      "Two-factor authentication is required",
      403
    );
  }
};

export const requirePlatformOperator = (actor: AgentActor) => {
  requireHumanAdmin(actor);
  if (!actor.platformAdmin) {
    throw new AgentError("forbidden", "A platform operator is required", 403);
  }
};

export const inboxAllowed = (
  actor: AgentActor,
  inbox: { organization_id: string; id: string }
) =>
  actor.organizationId === inbox.organization_id &&
  (actor.kind !== "agent" || actor.inboxIds.includes(inbox.id));

export const encodeCursor = (createdAt: number, id: string) =>
  `${createdAt}.${id}`;

export const decodeCursor = (value: string | undefined) => {
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator <= 0 || separator === value.length - 1) {
    throw new AgentError("invalid_cursor", "Invalid cursor");
  }
  const createdAt = Number(value.slice(0, separator));
  const id = value.slice(separator + 1);
  if (!Number.isSafeInteger(createdAt) || createdAt < 0 || id.length > 128) {
    throw new AgentError("invalid_cursor", "Invalid cursor");
  }
  return { createdAt, id };
};

export const requestIdFor = (c: AgentContext) =>
  c.get("requestId") ||
  c.res.headers.get("X-Request-Id") ||
  crypto.randomUUID();

export const auditStatement = (
  db: D1Database,
  actor: Pick<AgentActor, "id" | "organizationId" | "kind">,
  requestId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>
) =>
  db
    .prepare(
      `INSERT INTO agent_audit
      (id, organization_id, actor_type, actor_id, action, resource_type, resource_id, request_id, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      actor.organizationId,
      actor.kind === "legacy" ? "human" : actor.kind,
      actor.id,
      action,
      resourceType,
      resourceId,
      requestId,
      metadata ? JSON.stringify(metadata) : null,
      Date.now()
    );

export const jsonInput = async <T>(
  c: AgentContext,
  schema: { parse(value: unknown): T }
): Promise<T> => {
  let input: unknown;
  try {
    input = await c.req.json();
  } catch {
    throw new AgentError("invalid_json", "Expected a JSON request body");
  }
  return schema.parse(input);
};
