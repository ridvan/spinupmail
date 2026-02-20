import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { emailAddresses, emailAttachments, emails } from "@/db";
import type { AppDb } from "@/platform/db/client";

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

export const listEmailsForAddress = ({
  db,
  addressId,
  after,
  before,
  order,
  limit,
}: {
  db: AppDb;
  addressId: string;
  after?: Date;
  before?: Date;
  order: "asc" | "desc";
  limit: number;
}) => {
  const conditions = [eq(emails.addressId, addressId)];

  if (after !== undefined) {
    conditions.push(gte(emails.receivedAt, after));
  }
  if (before !== undefined) {
    conditions.push(lte(emails.receivedAt, before));
  }

  const whereClause =
    conditions.length > 1 ? and(...conditions) : conditions[0];

  return db
    .select({
      id: emails.id,
      addressId: emails.addressId,
      to: emails.to,
      from: emails.from,
      subject: emails.subject,
      messageId: emails.messageId,
      rawSize: emails.rawSize,
      rawTruncated: emails.rawTruncated,
      receivedAt: emails.receivedAt,
      hasHtml: sql<number>`case when ${emails.bodyHtml} is null then 0 else 1 end`,
      hasText: sql<number>`case when ${emails.bodyText} is null then 0 else 1 end`,
    })
    .from(emails)
    .where(whereClause)
    .orderBy(order === "asc" ? asc(emails.receivedAt) : desc(emails.receivedAt))
    .limit(limit);
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
