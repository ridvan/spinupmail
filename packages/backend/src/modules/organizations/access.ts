import { and, eq } from "drizzle-orm";
import { members } from "@/db";
import type { AppDb } from "@/platform/db/client";

export const isOrganizationAdminRole = (role: string | null | undefined) =>
  role === "owner" || role === "admin";

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
