import {
  agentApproveDraftRequestSchema,
  agentCreateDraftRequestSchema,
  agentDraftListQuerySchema,
  agentUpdateDraftRequestSchema,
} from "@spinupmail/contracts";
import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { sanitizeEmailHtmlForAgent } from "@/shared/utils/email-html";
import {
  AgentError,
  auditStatement,
  decodeCursor,
  encodeCursor,
  jsonInput,
  requestIdFor,
  requireCapability,
  requireHumanAdmin,
} from "./core";
import { prepareAgentEventStatements } from "./events";
import {
  abandonIdempotency,
  canonicalRequestHash,
  claimIdempotency,
  completeIdempotencyStatement,
  requireIdempotencyKey,
} from "./idempotency";
import { requireAccessibleInbox } from "./inboxes";

export type AgentDraftRow = {
  id: string;
  organization_id: string;
  inbox_id: string;
  thread_id: string | null;
  created_by_principal_id: string | null;
  to_json: string;
  cc_json: string;
  bcc_json: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  in_reply_to: string | null;
  references_json: string;
  version: number;
  content_hash: string;
  approved_hash: string | null;
  approved_by_user_id: string | null;
  approved_at: number | null;
  submitted_at: number | null;
  created_at: number;
  updated_at: number;
};

export const draftContent = (value: {
  inboxId: string;
  threadId?: string | null;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  inReplyTo?: string | null;
  references?: string[];
}) => ({
  inboxId: value.inboxId,
  threadId: value.threadId ?? null,
  to: value.to,
  cc: value.cc ?? [],
  bcc: value.bcc ?? [],
  subject: value.subject ?? "",
  bodyText: value.bodyText ?? null,
  bodyHtml: value.bodyHtml ?? null,
  inReplyTo: value.inReplyTo ?? null,
  references: value.references ?? [],
});

export const draftDto = (row: AgentDraftRow) => ({
  id: row.id,
  inboxId: row.inbox_id,
  threadId: row.thread_id,
  to: JSON.parse(row.to_json) as string[],
  cc: JSON.parse(row.cc_json) as string[],
  bcc: JSON.parse(row.bcc_json) as string[],
  subject: row.subject,
  bodyText: row.body_text,
  bodyHtml: row.body_html,
  inReplyTo: row.in_reply_to,
  references: JSON.parse(row.references_json) as string[],
  version: row.version,
  contentHash: row.content_hash,
  approvedHash: row.approved_hash,
  approvedAt: row.approved_at,
  submittedAt: row.submitted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const findDraft = (db: D1Database, organizationId: string, id: string) =>
  db
    .prepare(
      `SELECT id, organization_id, inbox_id, thread_id, created_by_principal_id,
      to_json, cc_json, bcc_json, subject, body_text, body_html, in_reply_to,
      references_json, version, content_hash, approved_hash, approved_by_user_id,
      approved_at, submitted_at, created_at, updated_at
      FROM agent_drafts WHERE organization_id = ? AND id = ?`
    )
    .bind(organizationId, id)
    .first<AgentDraftRow>();

const normalizeDraftContent = async (
  value: ReturnType<typeof draftContent>
) => ({
  ...value,
  bodyHtml: value.bodyHtml
    ? await sanitizeEmailHtmlForAgent(value.bodyHtml)
    : null,
});

export const createAgentDraftsRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.post("/drafts", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "drafts:write");
    const input = await jsonInput(c, agentCreateDraftRequestSchema);
    await requireAccessibleInbox(c.env.SUM_DB, actor, input.inboxId);
    const key = requireIdempotencyKey(c);
    const content = await normalizeDraftContent(draftContent(input));
    const contentHash = await canonicalRequestHash(content);
    const claim = await claimIdempotency<{ draft: unknown }>({
      db: c.env.SUM_DB,
      organizationId: actor.organizationId,
      actorId: actor.credentialId ?? actor.id,
      operation: "drafts.create",
      key,
      input: content,
    });
    if (claim.kind === "replay") return c.json(claim.response, 200);

    const now = Date.now();
    const row: AgentDraftRow = {
      id: input.id,
      organization_id: actor.organizationId,
      inbox_id: input.inboxId,
      thread_id: content.threadId,
      created_by_principal_id: actor.kind === "agent" ? actor.id : null,
      to_json: JSON.stringify(content.to),
      cc_json: JSON.stringify(content.cc),
      bcc_json: JSON.stringify(content.bcc),
      subject: content.subject,
      body_text: content.bodyText,
      body_html: content.bodyHtml,
      in_reply_to: content.inReplyTo,
      references_json: JSON.stringify(content.references),
      version: 1,
      content_hash: contentHash,
      approved_hash: null,
      approved_by_user_id: null,
      approved_at: null,
      submitted_at: null,
      created_at: now,
      updated_at: now,
    };
    const response = { draft: draftDto(row) };
    try {
      await c.env.SUM_DB.batch([
        c.env.SUM_DB.prepare(
          `INSERT INTO agent_drafts
          (id, organization_id, inbox_id, thread_id, created_by_principal_id,
           to_json, cc_json, bcc_json, subject, body_text, body_html, in_reply_to,
           references_json, version, content_hash, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
        ).bind(
          row.id,
          row.organization_id,
          row.inbox_id,
          row.thread_id,
          row.created_by_principal_id,
          row.to_json,
          row.cc_json,
          row.bcc_json,
          row.subject,
          row.body_text,
          row.body_html,
          row.in_reply_to,
          row.references_json,
          row.content_hash,
          now,
          now
        ),
        ...prepareAgentEventStatements(c.env.SUM_DB, {
          id: crypto.randomUUID(),
          organizationId: actor.organizationId,
          inboxId: input.inboxId,
          type: "draft.created",
          resourceType: "draft",
          resourceId: input.id,
          createdAt: now,
        }),
        auditStatement(
          c.env.SUM_DB,
          actor,
          requestIdFor(c),
          "draft.created",
          "draft",
          input.id
        ),
        completeIdempotencyStatement(
          c.env.SUM_DB,
          claim.id,
          "draft",
          input.id,
          response
        ),
      ]);
      return c.json(response, 201);
    } catch (error) {
      await abandonIdempotency(c.env.SUM_DB, claim.id);
      throw error;
    }
  });

  router.patch("/drafts/:id", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "drafts:write");
    const current = await findDraft(
      c.env.SUM_DB,
      actor.organizationId,
      c.req.param("id")
    );
    if (!current) throw new AgentError("not_found", "Draft not found", 404);
    await requireAccessibleInbox(c.env.SUM_DB, actor, current.inbox_id);
    if (current.submitted_at !== null) {
      throw new AgentError(
        "draft_immutable",
        "Submitted drafts are immutable",
        409
      );
    }
    const input = await jsonInput(c, agentUpdateDraftRequestSchema);
    const content = await normalizeDraftContent(
      draftContent({ ...input, inboxId: current.inbox_id })
    );
    const hash = await canonicalRequestHash(content);
    const now = Date.now();
    const result = await c.env.SUM_DB.prepare(
      `UPDATE agent_drafts SET thread_id = ?, to_json = ?, cc_json = ?,
      bcc_json = ?, subject = ?, body_text = ?, body_html = ?, in_reply_to = ?,
      references_json = ?, content_hash = ?, version = version + 1,
      approved_hash = NULL, approved_by_user_id = NULL, approved_at = NULL,
      updated_at = ?
      WHERE organization_id = ? AND id = ? AND version = ? AND submitted_at IS NULL`
    )
      .bind(
        content.threadId,
        JSON.stringify(content.to),
        JSON.stringify(content.cc),
        JSON.stringify(content.bcc),
        content.subject,
        content.bodyText,
        content.bodyHtml,
        content.inReplyTo,
        JSON.stringify(content.references),
        hash,
        now,
        actor.organizationId,
        current.id,
        input.version
      )
      .run();
    if ((result.meta.changes ?? 0) === 0) {
      throw new AgentError("version_conflict", "Draft version changed", 409);
    }
    const updated = await findDraft(
      c.env.SUM_DB,
      actor.organizationId,
      current.id
    );
    return c.json({ draft: draftDto(updated!) });
  });

  router.post("/drafts/:id/approve", async c => {
    const actor = c.get("agentActor");
    requireHumanAdmin(actor);
    const input = await jsonInput(c, agentApproveDraftRequestSchema);
    const key = requireIdempotencyKey(c);
    const draft = await findDraft(
      c.env.SUM_DB,
      actor.organizationId,
      c.req.param("id")
    );
    if (!draft) throw new AgentError("not_found", "Draft not found", 404);
    if (draft.submitted_at !== null) {
      throw new AgentError(
        "draft_immutable",
        "Submitted drafts are immutable",
        409
      );
    }
    if (draft.version !== input.version) {
      throw new AgentError("version_conflict", "Draft version changed", 409);
    }
    const claim = await claimIdempotency<{ draft: unknown }>({
      db: c.env.SUM_DB,
      organizationId: actor.organizationId,
      actorId: actor.id,
      operation: "drafts.approve",
      key,
      input: { id: draft.id, version: input.version, hash: draft.content_hash },
    });
    if (claim.kind === "replay") return c.json(claim.response, 200);
    const now = Date.now();
    const approved = {
      ...draft,
      approved_hash: draft.content_hash,
      approved_by_user_id: actor.id,
      approved_at: now,
      updated_at: now,
    };
    const response = { draft: draftDto(approved) };
    try {
      await c.env.SUM_DB.batch([
        c.env.SUM_DB.prepare(
          `UPDATE agent_drafts SET approved_hash = content_hash,
          approved_by_user_id = ?, approved_at = ?, updated_at = ?
          WHERE organization_id = ? AND id = ? AND version = ?
            AND submitted_at IS NULL`
        ).bind(
          actor.id,
          now,
          now,
          actor.organizationId,
          draft.id,
          input.version
        ),
        ...prepareAgentEventStatements(c.env.SUM_DB, {
          id: crypto.randomUUID(),
          organizationId: actor.organizationId,
          inboxId: draft.inbox_id,
          type: "draft.approved",
          resourceType: "draft",
          resourceId: draft.id,
          data: { contentHash: draft.content_hash },
          createdAt: now,
        }),
        auditStatement(
          c.env.SUM_DB,
          actor,
          requestIdFor(c),
          "draft.approved",
          "draft",
          draft.id,
          { contentHash: draft.content_hash }
        ),
        completeIdempotencyStatement(
          c.env.SUM_DB,
          claim.id,
          "draft",
          draft.id,
          response
        ),
      ]);
      return c.json(response, 200);
    } catch (error) {
      await abandonIdempotency(c.env.SUM_DB, claim.id);
      throw error;
    }
  });

  router.get("/drafts", async c => {
    const actor = c.get("agentActor");
    requireCapability(actor, "drafts:write");
    const query = agentDraftListQuerySchema.parse(c.req.query());
    await requireAccessibleInbox(c.env.SUM_DB, actor, query.inboxId);
    const cursor = decodeCursor(query.cursor);
    const rows = await c.env.SUM_DB.prepare(
      `SELECT id, organization_id, inbox_id, thread_id, created_by_principal_id,
      to_json, cc_json, bcc_json, subject, body_text, body_html, in_reply_to,
      references_json, version, content_hash, approved_hash, approved_by_user_id,
      approved_at, submitted_at, created_at, updated_at
      FROM agent_drafts WHERE organization_id = ? AND inbox_id = ?
      ${cursor ? "AND (updated_at < ? OR (updated_at = ? AND id < ?))" : ""}
      ORDER BY updated_at DESC, id DESC LIMIT ?`
    )
      .bind(
        actor.organizationId,
        query.inboxId,
        ...(cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : []),
        query.limit + 1
      )
      .all<AgentDraftRow>();
    const hasMore = rows.results.length > query.limit;
    const selected = hasMore
      ? rows.results.slice(0, query.limit)
      : rows.results;
    const items = selected.map(draftDto);
    const last = items.at(-1);
    return c.json({
      items,
      nextCursor:
        hasMore && last ? encodeCursor(last.updatedAt, last.id) : null,
    });
  });

  return router;
};
