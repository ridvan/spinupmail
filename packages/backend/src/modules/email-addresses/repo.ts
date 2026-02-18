import { and, desc, eq, sql } from "drizzle-orm";
import { emailAddresses } from "@/db";
import type { AppDb } from "@/platform/db/client";

export const listAddressesByOrganization = (
  db: AppDb,
  organizationId: string
) =>
  db
    .select({
      id: emailAddresses.id,
      address: emailAddresses.address,
      localPart: emailAddresses.localPart,
      domain: emailAddresses.domain,
      tag: emailAddresses.tag,
      meta: emailAddresses.meta,
      createdAt: emailAddresses.createdAt,
      expiresAt: emailAddresses.expiresAt,
      lastReceivedAt: emailAddresses.lastReceivedAt,
    })
    .from(emailAddresses)
    .where(eq(emailAddresses.organizationId, organizationId))
    .orderBy(desc(emailAddresses.createdAt));

export type RecentAddressActivityCursor = {
  recentActivityMs: number;
  id: string;
};

export const listRecentAddressActivityPage = ({
  db,
  organizationId,
  limit,
  cursor,
}: {
  db: AppDb;
  organizationId: string;
  limit: number;
  cursor?: RecentAddressActivityCursor;
}) => {
  const recentActivityExpr = sql<number>`coalesce(${emailAddresses.lastReceivedAt}, ${emailAddresses.createdAt})`;
  const whereClause = cursor
    ? and(
        eq(emailAddresses.organizationId, organizationId),
        sql`(${recentActivityExpr} < ${cursor.recentActivityMs} OR (${recentActivityExpr} = ${cursor.recentActivityMs} AND ${emailAddresses.id} < ${cursor.id}))`
      )
    : eq(emailAddresses.organizationId, organizationId);

  return db
    .select({
      id: emailAddresses.id,
      address: emailAddresses.address,
      localPart: emailAddresses.localPart,
      domain: emailAddresses.domain,
      tag: emailAddresses.tag,
      meta: emailAddresses.meta,
      createdAt: emailAddresses.createdAt,
      expiresAt: emailAddresses.expiresAt,
      lastReceivedAt: emailAddresses.lastReceivedAt,
      recentActivityMs: recentActivityExpr,
    })
    .from(emailAddresses)
    .where(whereClause)
    .orderBy(desc(recentActivityExpr), desc(emailAddresses.id))
    .limit(limit + 1);
};

export const findAddressByIdAndOrganization = (
  db: AppDb,
  addressId: string,
  organizationId: string
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

export const findAddressByValue = (db: AppDb, address: string) =>
  db
    .select({ id: emailAddresses.id })
    .from(emailAddresses)
    .where(eq(emailAddresses.address, address))
    .get();

export const insertAddress = (
  db: AppDb,
  values: {
    id: string;
    organizationId: string;
    userId: string;
    address: string;
    localPart: string;
    domain: string;
    tag?: string;
    meta?: string;
    expiresAt?: Date;
  }
) =>
  db
    .insert(emailAddresses)
    .values({
      ...values,
      autoCreated: false,
    })
    .run();

export const deleteAddressByIdAndOrganization = (
  db: AppDb,
  addressId: string,
  organizationId: string
) =>
  db
    .delete(emailAddresses)
    .where(
      and(
        eq(emailAddresses.id, addressId),
        eq(emailAddresses.organizationId, organizationId)
      )
    )
    .run();
