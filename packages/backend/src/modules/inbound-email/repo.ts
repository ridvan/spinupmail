import { and, eq, lt, sql } from "drizzle-orm";
import { emailAddresses, emails } from "@/db";
import type { AppDb } from "@/platform/db/client";

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

export const insertInboundEmail = (
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
) => db.insert(emails).values(values).run();

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

export const deleteEmailsForAddress = (db: AppDb, addressId: string) =>
  db.delete(emails).where(eq(emails.addressId, addressId)).run();

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
