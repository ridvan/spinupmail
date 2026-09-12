import { agentIdempotencyKeySchema } from "@spinupmail/contracts";
import type { AgentContext } from "./core";
import { AgentError, digestSecret } from "./core";

type IdempotencyRow = {
  id: string;
  request_hash: string;
  state: "pending" | "complete";
  response_json: string | null;
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
};

export const canonicalRequestHash = (value: unknown) =>
  digestSecret(JSON.stringify(canonicalize(value)));

export const requireIdempotencyKey = (c: AgentContext) => {
  const parsed = agentIdempotencyKeySchema.safeParse(
    c.req.header("Idempotency-Key")
  );
  if (!parsed.success) {
    throw new AgentError(
      "idempotency_key_required",
      "A valid Idempotency-Key header is required"
    );
  }
  return parsed.data;
};

export type IdempotencyClaim<T> =
  { kind: "claimed"; id: string } | { kind: "replay"; response: T };

export const claimIdempotency = async <T>(args: {
  db: D1Database;
  organizationId: string;
  actorId: string;
  operation: string;
  key: string;
  input: unknown;
}): Promise<IdempotencyClaim<T>> => {
  const requestHash = await canonicalRequestHash(args.input);
  const id = crypto.randomUUID();
  const inserted = await args.db
    .prepare(
      `INSERT OR IGNORE INTO agent_idempotency_keys
      (id, organization_id, actor_id, operation, key, request_hash, state, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .bind(
      id,
      args.organizationId,
      args.actorId,
      args.operation,
      args.key,
      requestHash,
      Date.now()
    )
    .run();

  const row = await args.db
    .prepare(
      `SELECT id, request_hash, state, response_json
      FROM agent_idempotency_keys
      WHERE organization_id = ? AND actor_id = ? AND operation = ? AND key = ?`
    )
    .bind(args.organizationId, args.actorId, args.operation, args.key)
    .first<IdempotencyRow>();

  if (!row) {
    throw new AgentError(
      "idempotency_unavailable",
      "Idempotency state is unavailable",
      503
    );
  }
  if (row.request_hash !== requestHash) {
    throw new AgentError(
      "idempotency_conflict",
      "Idempotency key was already used with different input",
      409
    );
  }
  if (row.state === "complete" && row.response_json) {
    return { kind: "replay", response: JSON.parse(row.response_json) as T };
  }
  if ((inserted.meta.changes ?? 0) === 0) {
    throw new AgentError(
      "idempotency_in_progress",
      "A matching request is still in progress",
      409
    );
  }
  return { kind: "claimed", id: row.id };
};

export const completeIdempotencyStatement = (
  db: D1Database,
  id: string,
  resultType: string,
  resultId: string,
  response: unknown
) =>
  db
    .prepare(
      `UPDATE agent_idempotency_keys
      SET state = 'complete', result_type = ?, result_id = ?, response_json = ?, completed_at = ?
      WHERE id = ? AND state = 'pending'`
    )
    .bind(resultType, resultId, JSON.stringify(response), Date.now(), id);

export const abandonIdempotency = async (db: D1Database, id: string) => {
  await db
    .prepare(
      "DELETE FROM agent_idempotency_keys WHERE id = ? AND state = 'pending'"
    )
    .bind(id)
    .run();
};
