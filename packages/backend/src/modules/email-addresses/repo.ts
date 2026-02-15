import { and, desc, eq } from "drizzle-orm";
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
