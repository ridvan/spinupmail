import { and, eq, lt, sql } from "drizzle-orm";
import { emailAddresses, emailAttachments, emails } from "@/db";
import type { AppDb } from "@/platform/db/client";
import {
  buildDeleteEmailSearchEntriesByAddressIdStatement,
  buildInsertEmailSearchEntryStatement,
} from "@/modules/emails/repo";

export const findAddressByRecipient = (db: AppDb, recipient: string) =>
  db
    .select({
      id: emailAddresses.id,
      organizationId: emailAddresses.organizationId,
      userId: emailAddresses.userId,
      expiresAt: emailAddresses.expiresAt,
      meta: emailAddresses.meta,
    })
    .from(emailAddresses)
    .where(eq(emailAddresses.address, recipient))
    .get();

export const findInboundEmailByAddressAndMessageId = (
  db: AppDb,
  addressId: string,
  messageId: string
) =>
  db
    .select({
      id: emails.id,
    })
    .from(emails)
    .where(
      and(eq(emails.addressId, addressId), eq(emails.messageId, messageId))
    )
    .get();

export const getOrganizationAttachmentStorageUsage = async (
  db: AppDb,
  organizationId: string
) => {
  const row = await db
    .select({
      totalBytes: sql<number>`coalesce(sum(${emailAttachments.size}), 0)`,
    })
    .from(emailAttachments)
    .where(eq(emailAttachments.organizationId, organizationId))
    .get();

  return Number(row?.totalBytes ?? 0);
};

export const insertEmailAttachmentIfOrganizationQuotaAllows = async (
  db: AppDb,
  values: {
    id: string;
    emailId: string;
    organizationId: string;
    addressId: string;
    userId: string;
    filename: string;
    contentType: string;
    size: number;
    r2Key: string;
    disposition?: string | null;
    contentId?: string | null;
    maxOrganizationAttachmentStorageBytes: number;
  }
) => {
  const statement = db.$client
    .prepare(
      `
        INSERT INTO email_attachments (
          id,
          email_id,
          organization_id,
          address_id,
          user_id,
          filename,
          content_type,
          size,
          r2_key,
          disposition,
          content_id
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE coalesce(
          (
            SELECT sum(size)
            FROM email_attachments
            WHERE organization_id = ?
          ),
          0
        ) + ? <= ?
      `
    )
    .bind(
      values.id,
      values.emailId,
      values.organizationId,
      values.addressId,
      values.userId,
      values.filename,
      values.contentType,
      values.size,
      values.r2Key,
      values.disposition ?? null,
      values.contentId ?? null,
      values.organizationId,
      values.size,
      values.maxOrganizationAttachmentStorageBytes
    );

  const insertResults = await db.$client.batch([statement]);
  const inserted = Number(insertResults[0]?.meta?.changes ?? 0) > 0;

  return { inserted };
};

export const listSampleEmailsForAddress = (db: AppDb, addressId: string) =>
  db
    .select({
      subject: emails.subject,
      receivedAt: emails.receivedAt,
    })
    .from(emails)
    .where(and(eq(emails.addressId, addressId), eq(emails.isSample, true)));

export const insertInboundEmail = async (
  db: AppDb,
  values: {
    id: string;
    addressId: string;
    messageId?: string;
    sender?: string;
    from: string;
    to: string;
    subject?: string;
    headers?: string;
    bodyHtml?: string;
    bodyText?: string;
    raw?: string;
    rawSize: number;
    rawTruncated: boolean;
    isSample?: boolean;
    receivedAt: Date;
    countAlreadyReserved: boolean;
  }
) => {
  const insertEmailStatement = db.$client
    .prepare(
      `
        INSERT OR IGNORE INTO emails (
          id,
          address_id,
          message_id,
          sender,
          "from",
          "to",
          subject,
          headers,
          body_html,
          body_text,
          raw,
          raw_size,
          raw_truncated,
          is_sample,
          received_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      values.id,
      values.addressId,
      values.messageId ?? null,
      values.sender ?? null,
      values.from,
      values.to,
      values.subject ?? null,
      values.headers ?? null,
      values.bodyHtml ?? null,
      values.bodyText ?? null,
      values.raw ?? null,
      values.rawSize ?? null,
      values.rawTruncated ? 1 : 0,
      values.isSample ? 1 : 0,
      values.receivedAt.getTime()
    );

  const insertResults = await db.$client.batch([insertEmailStatement]);
  const inserted = Number(insertResults[0]?.meta?.changes ?? 0) > 0;

  if (!inserted) {
    return { inserted: false };
  }

  const followUpStatements = [
    buildInsertEmailSearchEntryStatement({
      db,
      emailId: values.id,
      subject: values.subject,
      sender: values.sender,
      senderAddress: values.from,
      bodyText: values.bodyText,
    }),
  ];

  if (!values.countAlreadyReserved) {
    followUpStatements.unshift(
      db.$client
        .prepare(
          `
            UPDATE email_addresses
            SET email_count = email_count + 1
            WHERE id = ?
          `
        )
        .bind(values.addressId)
    );
  }

  await db.$client.batch(followUpStatements);

  return { inserted: true };
};

export const reserveInboxSlot = ({
  db,
  addressId,
  maxReceivedEmailCount,
}: {
  db: AppDb;
  addressId: string;
  maxReceivedEmailCount: number;
}) =>
  db
    .update(emailAddresses)
    .set({
      emailCount: sql`${emailAddresses.emailCount} + 1`,
    })
    .where(
      and(
        eq(emailAddresses.id, addressId),
        lt(emailAddresses.emailCount, maxReceivedEmailCount)
      )
    )
    .run()
    .then(result => result.meta.changes > 0);

export const incrementAddressEmailCount = (db: AppDb, addressId: string) =>
  db
    .update(emailAddresses)
    .set({
      emailCount: sql`${emailAddresses.emailCount} + 1`,
    })
    .where(eq(emailAddresses.id, addressId))
    .run();

export const decrementAddressEmailCount = (db: AppDb, addressId: string) =>
  db
    .update(emailAddresses)
    .set({
      emailCount: sql`max(${emailAddresses.emailCount} - 1, 0)`,
    })
    .where(eq(emailAddresses.id, addressId))
    .run();

export const resetAddressEmailCount = (db: AppDb, addressId: string) =>
  db
    .update(emailAddresses)
    .set({
      emailCount: 0,
    })
    .where(eq(emailAddresses.id, addressId))
    .run();

export const deleteEmailsForAddress = async (db: AppDb, addressId: string) => {
  await db.$client.batch([
    buildDeleteEmailSearchEntriesByAddressIdStatement(db, addressId),
    db.$client
      .prepare(`DELETE FROM emails WHERE address_id = ?`)
      .bind(addressId),
  ]);
};

export const updateAddressLastReceivedAt = (
  db: AppDb,
  addressId: string,
  receivedAt: Date
) =>
  db
    .update(emailAddresses)
    .set({ lastReceivedAt: receivedAt })
    .where(eq(emailAddresses.id, addressId))
    .run();
