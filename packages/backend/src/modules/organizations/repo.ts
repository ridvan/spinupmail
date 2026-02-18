import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { emailAddresses, emailAttachments, emails, members } from "@/db";
import type { AppDb } from "@/platform/db/client";

export const findOrganizationIdsForUser = async (db: AppDb, userId: string) => {
  const membershipRows = await db
    .select({
      organizationId: members.organizationId,
    })
    .from(members)
    .where(eq(members.userId, userId));

  return Array.from(new Set(membershipRows.map(row => row.organizationId)));
};

export const findOrganizationCounts = async (
  db: AppDb,
  organizationIds: string[]
) => {
  const [memberCountRows, addressCountRows, emailCountRows] = await Promise.all(
    [
      db
        .select({
          organizationId: members.organizationId,
          count: sql<number>`count(*)`,
        })
        .from(members)
        .where(inArray(members.organizationId, organizationIds))
        .groupBy(members.organizationId),
      db
        .select({
          organizationId: emailAddresses.organizationId,
          count: sql<number>`count(*)`,
        })
        .from(emailAddresses)
        .where(inArray(emailAddresses.organizationId, organizationIds))
        .groupBy(emailAddresses.organizationId),
      db
        .select({
          organizationId: emailAddresses.organizationId,
          count: sql<number>`count(*)`,
        })
        .from(emails)
        .innerJoin(emailAddresses, eq(emails.addressId, emailAddresses.id))
        .where(inArray(emailAddresses.organizationId, organizationIds))
        .groupBy(emailAddresses.organizationId),
    ]
  );

  return {
    memberCountRows,
    addressCountRows,
    emailCountRows,
  };
};

export const findEmailActivity = async (
  db: AppDb,
  organizationId: string,
  cutoff: Date
) => {
  return db
    .select({
      date: sql<string>`date(${emails.receivedAt} / 1000, 'unixepoch')`,
      count: sql<number>`count(*)`,
    })
    .from(emails)
    .innerJoin(emailAddresses, eq(emails.addressId, emailAddresses.id))
    .where(
      and(
        eq(emailAddresses.organizationId, organizationId),
        gte(emails.receivedAt, cutoff)
      )
    )
    .groupBy(sql`date(${emails.receivedAt} / 1000, 'unixepoch')`)
    .orderBy(asc(sql`date(${emails.receivedAt} / 1000, 'unixepoch')`));
};

export const findEmailSummary = async (db: AppDb, organizationId: string) => {
  const senderDomainExpr = sql<string>`lower(trim(replace(substr(${emails.from}, instr(${emails.from}, '@') + 1), '>', '')))`;

  const [
    emailCountRow,
    attachmentStatsRows,
    topDomainsRows,
    busiestInboxesRows,
    dormantInboxesRows,
  ] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(emails)
      .innerJoin(emailAddresses, eq(emails.addressId, emailAddresses.id))
      .where(eq(emailAddresses.organizationId, organizationId)),
    db
      .select({
        attachmentCount: sql<number>`count(*)`,
        attachmentSizeTotal: sql<number>`coalesce(sum(${emailAttachments.size}), 0)`,
      })
      .from(emailAttachments)
      .where(eq(emailAttachments.organizationId, organizationId)),
    db
      .select({
        domain: senderDomainExpr,
        count: sql<number>`count(*)`,
      })
      .from(emails)
      .innerJoin(emailAddresses, eq(emails.addressId, emailAddresses.id))
      .where(eq(emailAddresses.organizationId, organizationId))
      .groupBy(senderDomainExpr)
      .orderBy(desc(sql`count(*)`))
      .limit(3),
    db
      .select({
        addressId: emailAddresses.id,
        address: emailAddresses.address,
        count: sql<number>`count(*)`,
      })
      .from(emails)
      .innerJoin(emailAddresses, eq(emails.addressId, emailAddresses.id))
      .where(eq(emailAddresses.organizationId, organizationId))
      .groupBy(emailAddresses.id, emailAddresses.address)
      .orderBy(desc(sql`count(*)`))
      .limit(3),
    db
      .select({
        addressId: emailAddresses.id,
        address: emailAddresses.address,
        createdAt: emailAddresses.createdAt,
      })
      .from(emailAddresses)
      .where(
        and(
          eq(emailAddresses.organizationId, organizationId),
          sql`${emailAddresses.lastReceivedAt} is null`
        )
      )
      .orderBy(asc(emailAddresses.createdAt)),
  ]);

  return {
    emailCountRow,
    attachmentStatsRows,
    topDomainsRows,
    busiestInboxesRows,
    dormantInboxesRows,
  };
};
