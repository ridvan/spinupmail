import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { emailAddresses, emailAttachments, emails } from "@/db";
import type { AppDb } from "@/platform/db/client";

const EMAIL_SEARCH_MARKER_START = "__smfts_s__";
const EMAIL_SEARCH_MARKER_END = "__smfts_e__";
const EMAIL_SEARCH_MAX_TOKENS = 6;
const EMAIL_SEARCH_MAX_TOKEN_LENGTH = 48;
const SAFE_EMAIL_SEARCH_MARKER_PATTERN = /^[A-Za-z0-9_]+$/;

const assertSafeEmailSearchMarker = (value: string, name: string) => {
  if (!SAFE_EMAIL_SEARCH_MARKER_PATTERN.test(value)) {
    throw new Error(
      `${name} must contain only ASCII letters, numbers, and underscores`
    );
  }
};

assertSafeEmailSearchMarker(
  EMAIL_SEARCH_MARKER_START,
  "EMAIL_SEARCH_MARKER_START"
);
assertSafeEmailSearchMarker(EMAIL_SEARCH_MARKER_END, "EMAIL_SEARCH_MARKER_END");

const tokenizeEmailSearch = (value: string) =>
  value
    .normalize("NFKC")
    .match(/[\p{L}\p{N}]+/gu)
    ?.map(token => token.toLowerCase().slice(0, EMAIL_SEARCH_MAX_TOKEN_LENGTH))
    .filter(token => token.length > 0)
    .slice(0, EMAIL_SEARCH_MAX_TOKENS) ?? [];

const buildEmailSearchMatchQuery = (value: string) => {
  const tokens = tokenizeEmailSearch(value);
  if (tokens.length === 0) return null;

  const hasTrailingWhitespace = /\s$/.test(value);

  return tokens
    .map((token, index) => {
      const isPrefixToken =
        index === tokens.length - 1 && hasTrailingWhitespace === false;

      return `"${token.replaceAll('"', '""')}"${isPrefixToken ? "*" : ""}`;
    })
    .join(" AND ");
};

const buildEmailFilters = ({
  addressId,
  after,
  before,
}: {
  addressId: string;
  after?: Date;
  before?: Date;
}) => {
  const conditions = [eq(emails.addressId, addressId)];

  if (after !== undefined) {
    conditions.push(gte(emails.receivedAt, after));
  }
  if (before !== undefined) {
    conditions.push(lte(emails.receivedAt, before));
  }

  return conditions.length > 1 ? and(...conditions) : conditions[0];
};

export const findAddressByIdAndOrganization = (
  db: AppDb,
  organizationId: string,
  addressId: string
) =>
  db
    .select({
      id: emailAddresses.id,
      address: emailAddresses.address,
    })
    .from(emailAddresses)
    .where(
      and(
        eq(emailAddresses.id, addressId),
        eq(emailAddresses.organizationId, organizationId)
      )
    )
    .get();

export const findAddressByValueAndOrganization = (
  db: AppDb,
  organizationId: string,
  address: string
) =>
  db
    .select({
      id: emailAddresses.id,
      address: emailAddresses.address,
    })
    .from(emailAddresses)
    .where(
      and(
        eq(emailAddresses.address, address),
        eq(emailAddresses.organizationId, organizationId)
      )
    )
    .get();

export const insertEmailSearchEntry = async ({
  db,
  emailId,
  subject,
  sender,
  senderAddress,
  bodyText,
}: {
  db: AppDb;
  emailId: string;
  subject?: string | null;
  sender?: string | null;
  senderAddress: string;
  bodyText?: string | null;
}) => {
  await db.$client
    .prepare(
      `
        INSERT INTO emails_search (
          subject,
          sender,
          sender_address,
          body_text,
          email_id
        )
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .bind(subject ?? "", sender ?? "", senderAddress, bodyText ?? "", emailId)
    .run();
};

export const buildInsertEmailSearchEntryStatement = ({
  db,
  emailId,
  subject,
  sender,
  senderAddress,
  bodyText,
}: {
  db: AppDb;
  emailId: string;
  subject?: string | null;
  sender?: string | null;
  senderAddress: string;
  bodyText?: string | null;
}) =>
  db.$client
    .prepare(
      `
        INSERT INTO emails_search (
          subject,
          sender,
          sender_address,
          body_text,
          email_id
        )
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .bind(subject ?? "", sender ?? "", senderAddress, bodyText ?? "", emailId);

export const deleteEmailSearchEntryByEmailId = async (
  db: AppDb,
  emailId: string
) => {
  await db.$client
    .prepare(`DELETE FROM emails_search WHERE email_id = ?`)
    .bind(emailId)
    .run();
};

export const deleteEmailSearchEntriesByAddressId = async (
  db: AppDb,
  addressId: string
) => {
  await buildDeleteEmailSearchEntriesByAddressIdStatement(db, addressId).run();
};

export const deleteEmailSearchEntriesByEmailIds = async (
  db: AppDb,
  emailIds: string[]
) => {
  if (emailIds.length === 0) return;

  const placeholders = emailIds.map(() => "?").join(", ");
  await db.$client
    .prepare(`DELETE FROM emails_search WHERE email_id IN (${placeholders})`)
    .bind(...emailIds)
    .run();
};

export const buildDeleteEmailByIdAndAddressStatement = (
  db: AppDb,
  emailId: string,
  addressId: string
) =>
  db.$client
    .prepare(`DELETE FROM emails WHERE id = ? AND address_id = ?`)
    .bind(emailId, addressId);

export const buildDeleteEmailSearchEntryByEmailIdStatement = (
  db: AppDb,
  emailId: string
) =>
  db.$client
    .prepare(`DELETE FROM emails_search WHERE email_id = ?`)
    .bind(emailId);

export const buildDeleteEmailSearchEntriesByEmailIdsStatement = (
  db: AppDb,
  emailIds: string[]
) => {
  if (emailIds.length === 0) {
    throw new Error("emailIds must not be empty");
  }

  const placeholders = emailIds.map(() => "?").join(", ");
  return db.$client
    .prepare(`DELETE FROM emails_search WHERE email_id IN (${placeholders})`)
    .bind(...emailIds);
};

export const maybeBuildDeleteEmailSearchEntriesByEmailIdsStatement = (
  db: AppDb,
  emailIds: string[]
) => {
  if (emailIds.length === 0) {
    return null;
  }

  return buildDeleteEmailSearchEntriesByEmailIdsStatement(db, emailIds);
};

export const buildDeleteEmailSearchEntriesByAddressIdStatement = (
  db: AppDb,
  addressId: string
) =>
  db.$client
    .prepare(
      `
        DELETE FROM emails_search
        WHERE email_id IN (
          SELECT id FROM emails WHERE address_id = ?
        )
      `
    )
    .bind(addressId);

export const buildDecrementAddressEmailCountStatement = (
  db: AppDb,
  addressId: string
) =>
  db.$client
    .prepare(
      `
        UPDATE email_addresses
        SET email_count = max(email_count - 1, 0)
        WHERE id = ?
      `
    )
    .bind(addressId);

export const listEmailsForAddress = ({
  db,
  addressId,
  after,
  before,
  order,
  limit,
  offset = 0,
}: {
  db: AppDb;
  addressId: string;
  after?: Date;
  before?: Date;
  order: "asc" | "desc";
  limit: number;
  offset?: number;
}) => {
  const whereClause = buildEmailFilters({ addressId, after, before });

  return db
    .select({
      id: emails.id,
      addressId: emails.addressId,
      sender: emails.sender,
      to: emails.to,
      from: emails.from,
      subject: emails.subject,
      messageId: emails.messageId,
      rawSize: emails.rawSize,
      rawTruncated: emails.rawTruncated,
      isSample: emails.isSample,
      receivedAt: emails.receivedAt,
      hasHtml: sql<number>`case when ${emails.bodyHtml} is null then 0 else 1 end`,
      hasText: sql<number>`case when ${emails.bodyText} is null then 0 else 1 end`,
    })
    .from(emails)
    .where(whereClause)
    .orderBy(
      order === "asc" ? asc(emails.receivedAt) : desc(emails.receivedAt),
      order === "asc" ? asc(emails.id) : desc(emails.id)
    )
    .limit(limit)
    .offset(offset);
};

export const countEmailsForAddress = ({
  db,
  addressId,
  after,
  before,
}: {
  db: AppDb;
  addressId: string;
  after?: Date;
  before?: Date;
}) => {
  const whereClause = buildEmailFilters({ addressId, after, before });

  return db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(emails)
    .where(whereClause)
    .get();
};

export const searchEmailsForAddress = async ({
  db,
  addressId,
  search,
  limit,
  offset = 0,
}: {
  db: AppDb;
  addressId: string;
  search: string;
  limit: number;
  offset?: number;
}) => {
  const matchQuery = buildEmailSearchMatchQuery(search);
  if (!matchQuery) {
    return [];
  }

  const result = await db.$client
    .prepare(
      `
        SELECT
          emails.id AS id,
          emails.address_id AS addressId,
          emails.sender AS sender,
          emails."to" AS "to",
          emails."from" AS "from",
          emails.subject AS subject,
          emails.message_id AS messageId,
          emails.raw_size AS rawSize,
          emails.raw_truncated AS rawTruncated,
          emails.is_sample AS isSample,
          emails.received_at AS receivedAtMs,
          CASE WHEN emails.body_html IS NULL THEN 0 ELSE 1 END AS hasHtml,
          CASE WHEN emails.body_text IS NULL THEN 0 ELSE 1 END AS hasText,
          CASE
            WHEN instr(
              highlight(emails_search, 0, '${EMAIL_SEARCH_MARKER_START}', '${EMAIL_SEARCH_MARKER_END}'),
              '${EMAIL_SEARCH_MARKER_START}'
            ) > 0 THEN 0
            WHEN
              instr(
                highlight(emails_search, 1, '${EMAIL_SEARCH_MARKER_START}', '${EMAIL_SEARCH_MARKER_END}'),
                '${EMAIL_SEARCH_MARKER_START}'
              ) > 0
              OR instr(
                highlight(emails_search, 2, '${EMAIL_SEARCH_MARKER_START}', '${EMAIL_SEARCH_MARKER_END}'),
                '${EMAIL_SEARCH_MARKER_START}'
              ) > 0
            THEN 1
            ELSE 2
          END AS searchPriority,
          bm25(emails_search, 10.0, 6.0, 6.0, 2.0) AS relevance
        FROM emails_search
        INNER JOIN emails ON emails.id = emails_search.email_id
        WHERE emails_search MATCH ? AND emails.address_id = ?
        ORDER BY
          searchPriority ASC,
          relevance ASC,
          emails.received_at DESC,
          emails.id DESC
        LIMIT ?
        OFFSET ?
      `
    )
    .bind(matchQuery, addressId, limit, offset)
    .all<{
      id: string;
      addressId: string;
      sender: string | null;
      to: string;
      from: string;
      subject: string | null;
      messageId: string | null;
      rawSize: number | null;
      rawTruncated: number | boolean;
      isSample: number | boolean;
      receivedAtMs: number | null;
      hasHtml: number;
      hasText: number;
    }>();

  return (result.results ?? []).map(row => ({
    ...row,
    rawTruncated: Boolean(row.rawTruncated),
    isSample: Boolean(row.isSample),
    receivedAt:
      typeof row.receivedAtMs === "number" ? new Date(row.receivedAtMs) : null,
  }));
};

export const countSearchEmailsForAddress = async ({
  db,
  addressId,
  search,
}: {
  db: AppDb;
  addressId: string;
  search: string;
}) => {
  const matchQuery = buildEmailSearchMatchQuery(search);
  if (!matchQuery) {
    return 0;
  }

  const result = await db.$client
    .prepare(
      `
        SELECT count(*) AS count
        FROM emails_search
        INNER JOIN emails ON emails.id = emails_search.email_id
        WHERE emails_search MATCH ? AND emails.address_id = ?
      `
    )
    .bind(matchQuery, addressId)
    .first<{ count?: number | string | null }>();

  return Number(result?.count ?? 0) || 0;
};

export const findAttachmentCountsForEmails = (
  db: AppDb,
  organizationId: string,
  emailIds: string[]
) => {
  if (emailIds.length === 0) {
    return Promise.resolve([] as Array<{ emailId: string; count: number }>);
  }

  return db
    .select({
      emailId: emailAttachments.emailId,
      count: sql<number>`count(*)`,
    })
    .from(emailAttachments)
    .where(
      and(
        eq(emailAttachments.organizationId, organizationId),
        inArray(emailAttachments.emailId, emailIds)
      )
    )
    .groupBy(emailAttachments.emailId);
};

export const findEmailDetailByIdAndOrganization = (
  db: AppDb,
  organizationId: string,
  emailId: string
) =>
  db
    .select({
      id: emails.id,
      addressId: emails.addressId,
      address: emailAddresses.address,
      sender: emails.sender,
      to: emails.to,
      from: emails.from,
      subject: emails.subject,
      messageId: emails.messageId,
      headers: emails.headers,
      bodyHtml: emails.bodyHtml,
      bodyText: emails.bodyText,
      raw: emails.raw,
      rawSize: emails.rawSize,
      rawTruncated: emails.rawTruncated,
      isSample: emails.isSample,
      receivedAt: emails.receivedAt,
    })
    .from(emails)
    .innerJoin(
      emailAddresses,
      and(
        eq(emailAddresses.id, emails.addressId),
        eq(emailAddresses.organizationId, organizationId)
      )
    )
    .where(eq(emails.id, emailId))
    .get();

export const findEmailAttachmentsByEmailAndOrganization = (
  db: AppDb,
  organizationId: string,
  emailId: string
) =>
  db
    .select({
      id: emailAttachments.id,
      emailId: emailAttachments.emailId,
      filename: emailAttachments.filename,
      contentType: emailAttachments.contentType,
      size: emailAttachments.size,
      disposition: emailAttachments.disposition,
      contentId: emailAttachments.contentId,
    })
    .from(emailAttachments)
    .where(
      and(
        eq(emailAttachments.emailId, emailId),
        eq(emailAttachments.organizationId, organizationId)
      )
    )
    .orderBy(asc(emailAttachments.createdAt));

export const findEmailRawSourceByIdAndOrganization = (
  db: AppDb,
  organizationId: string,
  emailId: string
) =>
  db
    .select({
      id: emails.id,
      addressId: emails.addressId,
      raw: emails.raw,
    })
    .from(emails)
    .innerJoin(
      emailAddresses,
      and(
        eq(emailAddresses.id, emails.addressId),
        eq(emailAddresses.organizationId, organizationId)
      )
    )
    .where(eq(emails.id, emailId))
    .get();

export const findAttachmentByIdsAndOrganization = (
  db: AppDb,
  organizationId: string,
  emailId: string,
  attachmentId: string
) =>
  db
    .select()
    .from(emailAttachments)
    .where(
      and(
        eq(emailAttachments.id, attachmentId),
        eq(emailAttachments.emailId, emailId),
        eq(emailAttachments.organizationId, organizationId)
      )
    )
    .get();

export const findEmailDeleteTargetByIdAndOrganization = (
  db: AppDb,
  organizationId: string,
  emailId: string
) =>
  db
    .select({
      id: emails.id,
      addressId: emails.addressId,
    })
    .from(emails)
    .innerJoin(
      emailAddresses,
      and(
        eq(emailAddresses.id, emails.addressId),
        eq(emailAddresses.organizationId, organizationId)
      )
    )
    .where(eq(emails.id, emailId))
    .get();

export const findAttachmentKeysByEmailAndOrganization = (
  db: AppDb,
  organizationId: string,
  emailId: string
) =>
  db
    .select({ r2Key: emailAttachments.r2Key })
    .from(emailAttachments)
    .where(
      and(
        eq(emailAttachments.emailId, emailId),
        eq(emailAttachments.organizationId, organizationId)
      )
    );

export const deleteEmailByIdAndAddress = (
  db: AppDb,
  emailId: string,
  addressId: string
) =>
  db
    .delete(emails)
    .where(and(eq(emails.id, emailId), eq(emails.addressId, addressId)))
    .run();

export const decrementAddressEmailCount = (db: AppDb, addressId: string) =>
  db
    .update(emailAddresses)
    .set({
      emailCount: sql`max(${emailAddresses.emailCount} - 1, 0)`,
    })
    .where(eq(emailAddresses.id, addressId))
    .run();
