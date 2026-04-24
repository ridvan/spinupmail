import {
  EMAIL_LIST_LIMIT_DEFAULT,
  EMAIL_LIST_LIMIT_MAX,
  EMAIL_RAW_R2_CONTENT_TYPE,
} from "@/shared/constants";
import { isEmailAttachmentsEnabled, parseBooleanEnv } from "@/shared/env";
import {
  isSafeInlineImageContentType,
  rewriteEmailHtmlForRendering,
} from "@/shared/utils/email-html";
import {
  buildInlineContentDisposition,
  buildContentDisposition,
  getUtf8ByteLength,
  sanitizeFilename,
} from "@/shared/utils/string";
import { clampNumber, parseOptionalTimestamp } from "@/shared/utils/dates";
import { chunkArray, getRawEmailR2Key } from "@/shared/utils/r2";
import { normalizeAddress, parseSenderIdentity } from "@/shared/validation";
import { getDb } from "@/platform/db/client";
import {
  emailAttachmentQuerySchema,
  emailDetailQuerySchema,
  listEmailsQuerySchema,
  EMAIL_SEARCH_MAX_LENGTH,
  type EmailAttachmentQuery,
  type EmailDetailQuery,
  type ListEmailsQuery,
} from "./schemas";
import {
  buildDecrementAddressEmailCountStatement,
  buildDeleteEmailByIdAndAddressStatement,
  buildDeleteEmailSearchEntryByEmailIdStatement,
  countEmailsForAddress,
  countSearchEmailsForAddress,
  findAddressByIdAndOrganization,
  findAddressByValueAndOrganization,
  findAttachmentByIdsAndOrganization,
  findAttachmentCountsForEmails,
  findAttachmentKeysByEmailAndOrganization,
  findEmailAttachmentsByEmailAndOrganization,
  findEmailDeleteTargetByIdAndOrganization,
  findEmailDetailByIdAndOrganization,
  findEmailRawSourceByIdAndOrganization,
  listEmailsForAddress,
  searchEmailsForAddress,
} from "./repo";
import { toAttachmentResponse } from "./dto";

const parseListQuery = (payload: unknown): ListEmailsQuery => {
  const parsed = listEmailsQuerySchema.safeParse(payload);
  if (!parsed.success) {
    if (!payload || typeof payload !== "object") return {};

    const candidate = payload as Record<string, unknown>;
    const toNumber = (value: unknown) => {
      if (typeof value === "number") return value;
      if (typeof value !== "string") return undefined;

      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : undefined;
    };

    return {
      address:
        typeof candidate.address === "string" ? candidate.address : undefined,
      addressId:
        typeof candidate.addressId === "string"
          ? candidate.addressId
          : undefined,
      search:
        typeof candidate.search === "string" ? candidate.search : undefined,
      limit: toNumber(candidate.limit),
      page: toNumber(candidate.page),
      pageSize: toNumber(candidate.pageSize),
      order: typeof candidate.order === "string" ? candidate.order : undefined,
      after: typeof candidate.after === "string" ? candidate.after : undefined,
      before:
        typeof candidate.before === "string" ? candidate.before : undefined,
    };
  }
  return parsed.data;
};

const parseDetailQuery = (payload: unknown): EmailDetailQuery => {
  const parsed = emailDetailQuerySchema.safeParse(payload);
  if (!parsed.success) return {};
  return parsed.data;
};

const parseAttachmentQuery = (payload: unknown): EmailAttachmentQuery => {
  const parsed = emailAttachmentQuerySchema.safeParse(payload);
  if (!parsed.success) return {};
  return parsed.data;
};

const normalizeEmailSearch = (value: string | undefined) => {
  const normalized =
    value?.slice(0, EMAIL_SEARCH_MAX_LENGTH).trim().replace(/\s+/g, " ") ?? "";
  return normalized.length > 0 ? normalized : undefined;
};

const getRawDownloadPath = (
  env: CloudflareBindings,
  row: { id: string; raw: string | null }
) => {
  const hasRawInDb = typeof row.raw === "string" && row.raw.length > 0;
  const rawInR2Enabled = parseBooleanEnv(env.EMAIL_STORE_RAW_IN_R2, false);
  return hasRawInDb || rawInR2Enabled ? `/api/emails/${row.id}/raw` : undefined;
};

const buildAttachmentHeaders = ({
  contentDisposition,
  contentType,
  size,
}: {
  contentDisposition: string;
  contentType: string;
  size: number;
}) => ({
  "Content-Type": contentType || "application/octet-stream",
  "Content-Disposition": contentDisposition,
  "Content-Length": String(size),
  "Cache-Control": "private, max-age=0, must-revalidate",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});

export const listEmails = async ({
  env,
  organizationId,
  queryPayload,
}: {
  env: CloudflareBindings;
  organizationId: string;
  queryPayload: unknown;
}) => {
  const query = parseListQuery(queryPayload);
  const addressParam = query.address;
  const addressIdParam = query.addressId;
  const page = clampNumber(query.page ?? null, 1, Number.MAX_SAFE_INTEGER, 1);
  const pageSize = clampNumber(
    query.pageSize ?? query.limit ?? null,
    1,
    EMAIL_LIST_LIMIT_MAX,
    EMAIL_LIST_LIMIT_DEFAULT
  );
  const offset = (page - 1) * pageSize;
  const order = query.order === "asc" ? "asc" : "desc";

  if (!addressParam && !addressIdParam) {
    return {
      status: 400 as const,
      body: { error: "address or addressId is required" },
    };
  }

  const db = getDb(env);
  const attachmentsEnabled = isEmailAttachmentsEnabled(env);
  const addressRow = addressIdParam
    ? await findAddressByIdAndOrganization(db, organizationId, addressIdParam)
    : await findAddressByValueAndOrganization(
        db,
        organizationId,
        normalizeAddress(addressParam ?? "")
      );

  if (!addressRow) {
    return {
      status: 404 as const,
      body: { error: "address not found" },
    };
  }

  const after = parseOptionalTimestamp(query.after ?? null);
  const before = parseOptionalTimestamp(query.before ?? null);
  const search = normalizeEmailSearch(query.search);
  const hasUnsupportedSearchOrder = query.order === "asc";

  if (
    search &&
    (after !== undefined || before !== undefined || hasUnsupportedSearchOrder)
  ) {
    return {
      status: 400 as const,
      body: {
        error: "search does not support after, before, or order=asc parameters",
      },
    };
  }

  const [totalItems, rows] = search
    ? await Promise.all([
        countSearchEmailsForAddress({
          db,
          addressId: addressRow.id,
          search,
        }),
        searchEmailsForAddress({
          db,
          addressId: addressRow.id,
          search,
          limit: pageSize,
          offset,
        }),
      ])
    : await Promise.all([
        countEmailsForAddress({
          db,
          addressId: addressRow.id,
          after,
          before,
        }).then(row => Number(row?.count ?? 0)),
        listEmailsForAddress({
          db,
          addressId: addressRow.id,
          after,
          before,
          order,
          limit: pageSize,
          offset,
        }),
      ]);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const emailIds = rows.map(row => row.id);
  const attachmentCountRows = attachmentsEnabled
    ? await findAttachmentCountsForEmails(db, organizationId, emailIds)
    : [];

  const attachmentCountByEmail = new Map<string, number>();
  for (const row of attachmentCountRows) {
    attachmentCountByEmail.set(row.emailId, Number(row.count) || 0);
  }

  const items = rows.map(row => {
    const sender = parseSenderIdentity(row.sender);

    return {
      id: row.id,
      addressId: row.addressId,
      to: row.to,
      from: row.from,
      sender: row.sender ?? null,
      senderLabel: sender?.label ?? row.sender ?? row.from,
      subject: row.subject,
      messageId: row.messageId,
      rawSize: row.rawSize,
      rawTruncated: row.rawTruncated,
      isSample: Boolean(row.isSample),
      hasHtml: Number(row.hasHtml) > 0,
      hasText: Number(row.hasText) > 0,
      attachmentCount: attachmentCountByEmail.get(row.id) ?? 0,
      receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
      receivedAtMs: row.receivedAt ? row.receivedAt.getTime() : null,
    };
  });

  return {
    status: 200 as const,
    body: {
      address: addressRow.address,
      addressId: addressRow.id,
      items,
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
};

export const deleteEmail = async ({
  env,
  organizationId,
  emailId,
}: {
  env: CloudflareBindings;
  organizationId: string;
  emailId: string;
}) => {
  const db = getDb(env);
  const emailRow = await findEmailDeleteTargetByIdAndOrganization(
    db,
    organizationId,
    emailId
  );

  if (!emailRow) {
    return {
      status: 404 as const,
      body: { error: "email not found" },
    };
  }

  const attachmentRows = await findAttachmentKeysByEmailAndOrganization(
    db,
    organizationId,
    emailRow.id
  );

  if (env.R2_BUCKET) {
    const r2Keys = [
      ...attachmentRows.map(row => row.r2Key),
      getRawEmailR2Key({
        organizationId,
        addressId: emailRow.addressId,
        emailId: emailRow.id,
      }),
    ];

    try {
      for (const batch of chunkArray(r2Keys, 1000)) {
        await env.R2_BUCKET.delete(batch);
      }
    } catch (error) {
      console.error("[email] Failed to delete email files from R2", {
        organizationId,
        emailId: emailRow.id,
        error,
      });
      return {
        status: 500 as const,
        body: { error: "failed to clean up email files" },
      };
    }
  }

  await db.$client.batch([
    buildDeleteEmailByIdAndAddressStatement(
      db,
      emailRow.id,
      emailRow.addressId
    ),
    buildDeleteEmailSearchEntryByEmailIdStatement(db, emailRow.id),
    buildDecrementAddressEmailCountStatement(db, emailRow.addressId),
  ]);

  return {
    status: 200 as const,
    body: {
      id: emailRow.id,
      deleted: true,
    },
  };
};

export const getEmailDetail = async ({
  env,
  organizationId,
  emailId,
  queryPayload,
}: {
  env: CloudflareBindings;
  organizationId: string;
  emailId: string;
  queryPayload: unknown;
}) => {
  const query = parseDetailQuery(queryPayload);
  const includeRaw = query.raw === "true" || query.raw === "1";

  const db = getDb(env);
  const attachmentsEnabled = isEmailAttachmentsEnabled(env);
  const row = await findEmailDetailByIdAndOrganization(
    db,
    organizationId,
    emailId
  );

  if (!row) {
    return {
      status: 404 as const,
      body: { error: "email not found" },
    };
  }

  const attachmentRows = attachmentsEnabled
    ? await findEmailAttachmentsByEmailAndOrganization(
        db,
        organizationId,
        row.id
      )
    : [];

  let parsedHeaders: unknown = [];
  if (row.headers) {
    try {
      parsedHeaders = JSON.parse(row.headers);
    } catch {
      parsedHeaders = [];
    }
  }

  const rawDownloadPath = getRawDownloadPath(env, row);
  const attachments = attachmentRows.map(attachment =>
    toAttachmentResponse(attachment)
  );
  const html =
    attachmentsEnabled && row.bodyHtml
      ? rewriteEmailHtmlForRendering(row.bodyHtml, attachments)
      : row.bodyHtml;
  const sender = parseSenderIdentity(row.sender);
  const base = {
    id: row.id,
    addressId: row.addressId,
    address: row.address,
    to: row.to,
    from: row.from,
    sender: row.sender ?? null,
    senderLabel: sender?.label ?? row.sender ?? row.from,
    subject: row.subject,
    messageId: row.messageId,
    headers: parsedHeaders,
    html,
    text: row.bodyText,
    rawSize: row.rawSize,
    rawTruncated: row.rawTruncated,
    isSample: Boolean(row.isSample),
    ...(rawDownloadPath ? { rawDownloadPath } : {}),
    attachments,
    receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
    receivedAtMs: row.receivedAt ? row.receivedAt.getTime() : null,
  };

  return {
    status: 200 as const,
    body: includeRaw ? { ...base, raw: row.raw } : base,
  };
};

export const getEmailRaw = async ({
  env,
  organizationId,
  emailId,
}: {
  env: CloudflareBindings;
  organizationId: string;
  emailId: string;
}) => {
  const db = getDb(env);
  const row = await findEmailRawSourceByIdAndOrganization(
    db,
    organizationId,
    emailId
  );

  if (!row) {
    return new Response(JSON.stringify({ error: "email not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (row.raw && row.raw.length > 0) {
    const rawByteLength = getUtf8ByteLength(row.raw);
    return new Response(row.raw, {
      headers: {
        "Content-Type": EMAIL_RAW_R2_CONTENT_TYPE,
        "Content-Disposition": buildContentDisposition(`${row.id}.eml`),
        "Content-Length": String(rawByteLength),
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  }

  if (!env.R2_BUCKET) {
    return new Response(JSON.stringify({ error: "raw source not available" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawKey = getRawEmailR2Key({
    organizationId,
    addressId: row.addressId,
    emailId: row.id,
  });
  const object = await env.R2_BUCKET.get(rawKey);

  if (!object?.body) {
    return new Response(JSON.stringify({ error: "raw source not available" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(object.body as unknown as BodyInit, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType ?? EMAIL_RAW_R2_CONTENT_TYPE,
      "Content-Disposition": buildContentDisposition(`${row.id}.eml`),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
};

export const getEmailAttachment = async ({
  env,
  organizationId,
  emailId,
  attachmentId,
  queryPayload,
}: {
  env: CloudflareBindings;
  organizationId: string;
  emailId: string;
  attachmentId: string;
  queryPayload: unknown;
}) => {
  const query = parseAttachmentQuery(queryPayload);
  const isInlineRequest = query.inline === "true" || query.inline === "1";

  if (!isEmailAttachmentsEnabled(env)) {
    return new Response(JSON.stringify({ error: "Attachments are disabled" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!env.R2_BUCKET) {
    return new Response(
      JSON.stringify({ error: "Attachment storage is not configured" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const db = getDb(env);
  const attachmentRow = await findAttachmentByIdsAndOrganization(
    db,
    organizationId,
    emailId,
    attachmentId
  );

  if (!attachmentRow) {
    return new Response(JSON.stringify({ error: "attachment not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (
    isInlineRequest &&
    !isSafeInlineImageContentType(attachmentRow.contentType)
  ) {
    return new Response(
      JSON.stringify({ error: "attachment content cannot be rendered inline" }),
      {
        status: 415,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const object = await env.R2_BUCKET.get(attachmentRow.r2Key);
  if (!object?.body) {
    return new Response(
      JSON.stringify({ error: "attachment content not found" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const filename = sanitizeFilename(attachmentRow.filename);

  return new Response(object.body as unknown as BodyInit, {
    headers: buildAttachmentHeaders({
      contentDisposition: isInlineRequest
        ? buildInlineContentDisposition(filename)
        : buildContentDisposition(filename),
      contentType: attachmentRow.contentType || "application/octet-stream",
      size: attachmentRow.size,
    }),
  });
};
