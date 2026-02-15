import { eq } from "drizzle-orm";
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
