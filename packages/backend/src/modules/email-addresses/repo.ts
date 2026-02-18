import { and, asc, desc, eq, sql } from "drizzle-orm";
import { emailAddresses } from "@/db";
import type { AppDb } from "@/platform/db/client";

const addressListSelect = {
  id: emailAddresses.id,
  address: emailAddresses.address,
  localPart: emailAddresses.localPart,
  domain: emailAddresses.domain,
  tag: emailAddresses.tag,
  meta: emailAddresses.meta,
  createdAt: emailAddresses.createdAt,
  expiresAt: emailAddresses.expiresAt,
  lastReceivedAt: emailAddresses.lastReceivedAt,
};

export type AddressListSortBy = "createdAt" | "address" | "lastReceivedAt";
export type AddressListSortDirection = "asc" | "desc";

export const listAddressesByOrganization = ({
  db,
  organizationId,
  page,
  pageSize,
  sortBy,
  sortDirection,
}: {
  db: AppDb;
  organizationId: string;
  page: number;
  pageSize: number;
  sortBy: AddressListSortBy;
  sortDirection: AddressListSortDirection;
}) => {
  const order =
    sortDirection === "asc"
      ? {
          createdAt: asc(emailAddresses.createdAt),
          address: asc(emailAddresses.address),
          recentActivity: asc(
            sql<number>`coalesce(${emailAddresses.lastReceivedAt}, ${emailAddresses.createdAt})`
          ),
          id: asc(emailAddresses.id),
        }
      : {
          createdAt: desc(emailAddresses.createdAt),
          address: desc(emailAddresses.address),
          recentActivity: desc(
            sql<number>`coalesce(${emailAddresses.lastReceivedAt}, ${emailAddresses.createdAt})`
          ),
          id: desc(emailAddresses.id),
        };

  const primaryOrder =
    sortBy === "address"
      ? order.address
      : sortBy === "lastReceivedAt"
        ? order.recentActivity
        : order.createdAt;

  return db
    .select(addressListSelect)
    .from(emailAddresses)
    .where(eq(emailAddresses.organizationId, organizationId))
    .orderBy(primaryOrder, order.id)
    .limit(pageSize)
    .offset((page - 1) * pageSize);
};

export const countAddressesByOrganization = (
  db: AppDb,
  organizationId: string
) =>
  db
    .select({ count: sql<number>`count(*)` })
    .from(emailAddresses)
    .where(eq(emailAddresses.organizationId, organizationId))
    .get();

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
      ...addressListSelect,
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
    .select(addressListSelect)
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

export const updateAddressByIdAndOrganization = ({
  db,
  addressId,
  organizationId,
  values,
}: {
  db: AppDb;
  addressId: string;
  organizationId: string;
  values: {
    address: string;
    localPart: string;
    domain: string;
    tag: string | null;
    meta: string | null;
    expiresAt: Date | null;
  };
}) =>
  db
    .update(emailAddresses)
    .set(values)
    .where(
      and(
        eq(emailAddresses.id, addressId),
        eq(emailAddresses.organizationId, organizationId)
      )
    )
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
