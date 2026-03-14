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
  sortValueMs: number;
  id: string;
};

export type RecentAddressActivitySortBy = "recentActivity" | "createdAt";

const escapeLikePattern = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");

const buildRecentAddressActivityBaseWhereClause = ({
  organizationId,
  search,
}: {
  organizationId: string;
  search?: string;
}) => {
  const normalizedSearch = search?.trim().toLowerCase();

  if (!normalizedSearch) {
    return eq(emailAddresses.organizationId, organizationId);
  }

  return and(
    eq(emailAddresses.organizationId, organizationId),
    sql`lower(${emailAddresses.address}) like ${`%${escapeLikePattern(normalizedSearch)}%`} escape '\\'`
  );
};

export const countRecentAddressActivity = ({
  db,
  organizationId,
  search,
}: {
  db: AppDb;
  organizationId: string;
  search?: string;
}) =>
  db
    .select({ count: sql<number>`count(*)` })
    .from(emailAddresses)
    .where(
      buildRecentAddressActivityBaseWhereClause({
        organizationId,
        search,
      })
    )
    .get();

export const listRecentAddressActivityPage = ({
  db,
  organizationId,
  limit,
  cursor,
  sortBy,
  sortDirection,
  search,
}: {
  db: AppDb;
  organizationId: string;
  limit: number;
  cursor?: RecentAddressActivityCursor;
  sortBy: RecentAddressActivitySortBy;
  sortDirection: AddressListSortDirection;
  search?: string;
}) => {
  const recentActivityExpr = sql<number>`coalesce(${emailAddresses.lastReceivedAt}, ${emailAddresses.createdAt})`;
  const sortExpr =
    sortBy === "createdAt" ? emailAddresses.createdAt : recentActivityExpr;
  const isAscending = sortDirection === "asc";
  const primaryOrder = isAscending ? asc(sortExpr) : desc(sortExpr);
  const secondaryOrder = isAscending
    ? asc(emailAddresses.id)
    : desc(emailAddresses.id);
  const cursorComparisonOperator = isAscending ? sql`>` : sql`<`;
  const baseWhereClause = buildRecentAddressActivityBaseWhereClause({
    organizationId,
    search,
  });
  const whereClause = cursor
    ? and(
        baseWhereClause,
        sql`(${sortExpr} ${cursorComparisonOperator} ${cursor.sortValueMs} OR (${sortExpr} = ${cursor.sortValueMs} AND ${emailAddresses.id} ${cursorComparisonOperator} ${cursor.id}))`
      )
    : baseWhereClause;

  return db
    .select({
      ...addressListSelect,
      recentActivityMs: recentActivityExpr,
      sortValueMs: sortExpr,
    })
    .from(emailAddresses)
    .where(whereClause)
    .orderBy(primaryOrder, secondaryOrder)
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
  },
  maxAddressesPerOrganization: number
) =>
  db
    .run(
      sql`
      insert into email_addresses (
        id,
        organization_id,
        user_id,
        address,
        local_part,
        domain,
        tag,
        meta,
        expires_at,
        auto_created
      )
      select
        ${values.id},
        ${values.organizationId},
        ${values.userId},
        ${values.address},
        ${values.localPart},
        ${values.domain},
        ${values.tag ?? null},
        ${values.meta ?? null},
        ${values.expiresAt ? values.expiresAt.getTime() : null},
        ${0}
      where (
        select count(*)
        from email_addresses
        where organization_id = ${values.organizationId}
      ) < ${maxAddressesPerOrganization}
    `
    )
    .then(result => result.meta.changes > 0);

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
