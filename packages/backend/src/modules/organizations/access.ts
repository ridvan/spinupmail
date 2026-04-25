import { and, eq } from "drizzle-orm";
import { members } from "@/db";
import type { AppDb } from "@/platform/db/client";

const parseRoles = (role: string | null | undefined) =>
  (role ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

export const isOrganizationAdminRole = (role: string | null | undefined) =>
  parseRoles(role).some(value => value === "owner" || value === "admin");

export const isOrganizationOwnerRole = (role: string | null | undefined) =>
  parseRoles(role).includes("owner");

export const getOrganizationMemberRole = async ({
  db,
  organizationId,
  userId,
}: {
  db: AppDb;
  organizationId: string;
  userId: string;
}) => {
  const membership = await db
    .select({
      role: members.role,
    })
    .from(members)
    .where(
      and(
        eq(members.organizationId, organizationId),
        eq(members.userId, userId)
      )
    )
    .get();

  return membership?.role ?? null;
};
