import {
  agentCapabilitySchema,
  agentCreateEnrollmentRequestSchema,
  agentEnrollRequestSchema,
  agentEnrollmentTokenSchema,
  type AgentCapability,
} from "@spinupmail/contracts";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import {
  AgentError,
  auditStatement,
  digestSecret,
  jsonInput,
  requestIdFor,
  requireTwoFactor,
} from "./core";
import {
  abandonIdempotency,
  claimIdempotency,
  completeIdempotencyStatement,
  requireIdempotencyKey,
} from "./idempotency";
import { prepareAgentInboxCreation } from "./inboxes";

const ENROLLMENT_TTL_MS = 15 * 60 * 1000;

type EnrollmentRow = {
  id: string;
  organization_id: string;
  token_hash: string;
  name: string;
  inbox_limit: number;
  credential_expires_in_days: number;
  created_at: number;
  expires_at: number;
  consumed_at: number | null;
  revoked_at: number | null;
  created_by_user_id: string;
};

const uniqueCapabilities = (values: readonly AgentCapability[]) =>
  Array.from(new Set(values)).sort();

const enrollmentDto = (
  row: Omit<EnrollmentRow, "token_hash">,
  capabilities: AgentCapability[]
) => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  capabilities,
  inboxLimit: row.inbox_limit,
  credentialExpiresInDays: row.credential_expires_in_days,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  consumedAt: row.consumed_at,
  revokedAt: row.revoked_at,
});

const parseEnrollmentToken = (token: string) => {
  const parsed = agentEnrollmentTokenSchema.safeParse(token);
  if (!parsed.success) {
    throw new AgentError("invalid_enrollment", "Invalid enrollment token", 401);
  }
  const separator = token.indexOf(".");
  return {
    enrollmentId: token.slice("smenr_v1_".length, separator),
    secret: token.slice(separator + 1),
  };
};

export const createAgentEnrollmentRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.post("/enrollments", async c => {
    const actor = c.get("agentActor");
    requireTwoFactor(actor);
    const input = await jsonInput(c, agentCreateEnrollmentRequestSchema);
    const key = requireIdempotencyKey(c);
    const capabilities = uniqueCapabilities(input.capabilities);
    const claim = await claimIdempotency<{ enrollment: unknown }>({
      db: c.env.SUM_DB,
      organizationId: actor.organizationId,
      actorId: actor.id,
      operation: "enrollments.create",
      key,
      input,
    });
    if (claim.kind === "replay") return c.json(claim.response, 200);

    const now = Date.now();
    const row: Omit<EnrollmentRow, "token_hash"> = {
      id: input.enrollmentId,
      organization_id: actor.organizationId,
      name: input.name,
      inbox_limit: input.inboxLimit,
      credential_expires_in_days: input.credentialExpiresInDays,
      created_at: now,
      expires_at: now + ENROLLMENT_TTL_MS,
      consumed_at: null,
      revoked_at: null,
      created_by_user_id: actor.id,
    };
    const response = {
      enrollment: enrollmentDto(row, capabilities),
    };

    try {
      await c.env.SUM_DB.batch([
        c.env.SUM_DB.prepare(
          `INSERT INTO agent_enrollments
          (id, organization_id, token_hash, name, inbox_limit, credential_expires_in_days,
           created_by_user_id, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          input.enrollmentId,
          actor.organizationId,
          await digestSecret(input.enrollmentSecret),
          input.name,
          input.inboxLimit,
          input.credentialExpiresInDays,
          actor.id,
          now,
          now + ENROLLMENT_TTL_MS
        ),
        ...capabilities.map(capability =>
          c.env.SUM_DB.prepare(
            `INSERT INTO agent_enrollment_capabilities
            (organization_id, enrollment_id, capability) VALUES (?, ?, ?)`
          ).bind(actor.organizationId, input.enrollmentId, capability)
        ),
        auditStatement(
          c.env.SUM_DB,
          actor,
          requestIdFor(c),
          "enrollment.created",
          "enrollment",
          input.enrollmentId,
          { capabilities, inboxLimit: input.inboxLimit }
        ),
        completeIdempotencyStatement(
          c.env.SUM_DB,
          claim.id,
          "enrollment",
          input.enrollmentId,
          response
        ),
      ]);
    } catch (error) {
      await abandonIdempotency(c.env.SUM_DB, claim.id);
      throw error;
    }

    c.header("Cache-Control", "no-store");
    return c.json(response, 201);
  });

  router.post("/agent/enroll", async c => {
    const input = await jsonInput(c, agentEnrollRequestSchema);
    const key = requireIdempotencyKey(c);
    const { enrollmentId, secret } = parseEnrollmentToken(
      input.enrollmentToken
    );
    const enrollment = await c.env.SUM_DB.prepare(
      `SELECT id, organization_id, token_hash, name, inbox_limit,
      credential_expires_in_days, created_at, expires_at, consumed_at, revoked_at,
      created_by_user_id
      FROM agent_enrollments WHERE id = ?`
    )
      .bind(enrollmentId)
      .first<EnrollmentRow>();
    if (!enrollment || enrollment.token_hash !== (await digestSecret(secret))) {
      throw new AgentError(
        "invalid_enrollment",
        "Invalid enrollment token",
        401
      );
    }

    const claim = await claimIdempotency<{
      agent: unknown;
      credential: unknown;
      inbox: unknown;
    }>({
      db: c.env.SUM_DB,
      organizationId: enrollment.organization_id,
      actorId: enrollment.id,
      operation: "agent.enroll",
      key,
      input,
    });
    if (claim.kind === "replay") return c.json(claim.response, 200);

    const now = Date.now();
    if (enrollment.revoked_at !== null) {
      await abandonIdempotency(c.env.SUM_DB, claim.id);
      throw new AgentError("enrollment_revoked", "Enrollment was revoked", 410);
    }
    if (enrollment.consumed_at !== null) {
      await abandonIdempotency(c.env.SUM_DB, claim.id);
      throw new AgentError(
        "enrollment_consumed",
        "Enrollment was already used",
        410
      );
    }
    if (enrollment.expires_at <= now) {
      await abandonIdempotency(c.env.SUM_DB, claim.id);
      throw new AgentError("enrollment_expired", "Enrollment expired", 410);
    }

    const capabilityRows = await c.env.SUM_DB.prepare(
      `SELECT capability FROM agent_enrollment_capabilities
      WHERE organization_id = ? AND enrollment_id = ? ORDER BY capability`
    )
      .bind(enrollment.organization_id, enrollment.id)
      .all<{ capability: string }>();
    const capabilities = capabilityRows.results.map(row =>
      agentCapabilitySchema.parse(row.capability)
    );
    const principalId = crypto.randomUUID();
    const expiresAt =
      now + enrollment.credential_expires_in_days * 24 * 60 * 60 * 1000;
    try {
      const createdInbox = input.requestedInbox
        ? await prepareAgentInboxCreation({
            db: c.env.SUM_DB,
            env: c.env,
            organizationId: enrollment.organization_id,
            principalId,
            credentialId: input.credentialId,
            userId: enrollment.created_by_user_id,
            inboxLimit: enrollment.inbox_limit,
            input: { id: crypto.randomUUID(), ...input.requestedInbox },
            now,
          })
        : null;
      const response = {
        agent: {
          id: principalId,
          organizationId: enrollment.organization_id,
          name: input.agentName,
          createdAt: now,
          revokedAt: null,
        },
        credential: {
          id: input.credentialId,
          organizationId: enrollment.organization_id,
          principalId,
          name: input.credentialName,
          capabilities,
          inboxIds: createdInbox ? [createdInbox.response.id] : [],
          createdAt: now,
          expiresAt,
          revokedAt: null,
        },
        inbox: createdInbox?.response ?? null,
      };
      await c.env.SUM_DB.batch([
        c.env.SUM_DB.prepare(
          `INSERT INTO agent_principals
          (id, organization_id, name, created_by_user_id, created_at)
          VALUES (?, ?, ?, ?, ?)`
        ).bind(
          principalId,
          enrollment.organization_id,
          input.agentName,
          enrollment.created_by_user_id,
          now
        ),
        c.env.SUM_DB.prepare(
          `INSERT INTO agent_credentials
          (id, organization_id, principal_id, secret_hash, name, inbox_limit,
           created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          input.credentialId,
          enrollment.organization_id,
          principalId,
          await digestSecret(input.credentialSecret),
          input.credentialName,
          enrollment.inbox_limit,
          now,
          expiresAt
        ),
        ...capabilities.map(capability =>
          c.env.SUM_DB.prepare(
            `INSERT INTO agent_credential_capabilities
            (organization_id, credential_id, capability) VALUES (?, ?, ?)`
          ).bind(enrollment.organization_id, input.credentialId, capability)
        ),
        ...(createdInbox?.statements ?? []),
        c.env.SUM_DB.prepare(
          `UPDATE agent_enrollments
          SET consumed_at = ?, consumed_by_principal_id = ?
          WHERE organization_id = ? AND id = ? AND consumed_at IS NULL
            AND revoked_at IS NULL AND expires_at > ?`
        ).bind(
          now,
          principalId,
          enrollment.organization_id,
          enrollment.id,
          now
        ),
        auditStatement(
          c.env.SUM_DB,
          {
            id: principalId,
            organizationId: enrollment.organization_id,
            kind: "agent",
          },
          requestIdFor(c),
          "agent.enrolled",
          "agent",
          principalId,
          { enrollmentId: enrollment.id, credentialId: input.credentialId }
        ),
        completeIdempotencyStatement(
          c.env.SUM_DB,
          claim.id,
          "agent",
          principalId,
          response
        ),
      ]);
      c.header("Cache-Control", "no-store");
      return c.json(response, 201);
    } catch (error) {
      await abandonIdempotency(c.env.SUM_DB, claim.id);
      throw error;
    }
  });

  return router;
};
