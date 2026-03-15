import { and, eq, lt, sql } from "drizzle-orm";
import { emailAddresses } from "@/db";
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
    receivedAt: Date;
  }
) => {
  const insertEmailStatement = db.$client
    .prepare(
      `
        INSERT INTO emails (
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
          received_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      values.receivedAt.getTime()
    );

  await db.$client.batch([
    insertEmailStatement,
    buildInsertEmailSearchEntryStatement({
      db,
      emailId: values.id,
      subject: values.subject,
      sender: values.sender,
      senderAddress: values.from,
      bodyText: values.bodyText,
    }),
  ]);
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
