import { clampNumber } from "@/shared/utils/dates";
import { getDb } from "@/platform/db/client";
import {
  findEmailActivity,
  findEmailSummary,
  findOrganizationCounts,
  findOrganizationIdsForUser,
} from "./repo";

export const getOrganizationStats = async (
  env: CloudflareBindings,
  userId: string
) => {
  const db = getDb(env);
  const organizationIds = await findOrganizationIdsForUser(db, userId);

  if (organizationIds.length === 0) {
    return {
      items: [] as Array<{
        organizationId: string;
        memberCount: number;
        addressCount: number;
        emailCount: number;
      }>,
    };
  }

  const { memberCountRows, addressCountRows, emailCountRows } =
    await findOrganizationCounts(db, organizationIds);

  const memberCountByOrganizationId = new Map<string, number>();
  for (const row of memberCountRows) {
    memberCountByOrganizationId.set(row.organizationId, Number(row.count) || 0);
  }

  const addressCountByOrganizationId = new Map<string, number>();
  for (const row of addressCountRows) {
    if (!row.organizationId) continue;
    addressCountByOrganizationId.set(
      row.organizationId,
      Number(row.count) || 0
    );
  }

  const emailCountByOrganizationId = new Map<string, number>();
  for (const row of emailCountRows) {
    if (!row.organizationId) continue;
    emailCountByOrganizationId.set(row.organizationId, Number(row.count) || 0);
  }

  const items = organizationIds.map(organizationId => ({
    organizationId,
    memberCount: memberCountByOrganizationId.get(organizationId) ?? 0,
    addressCount: addressCountByOrganizationId.get(organizationId) ?? 0,
    emailCount: emailCountByOrganizationId.get(organizationId) ?? 0,
  }));

  return { items };
};

export const getEmailActivityStats = async ({
  env,
  organizationId,
  daysRaw,
}: {
  env: CloudflareBindings;
  organizationId: string;
  daysRaw: string | null;
}) => {
  const days = clampNumber(daysRaw, 1, 30, 14);

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  cutoff.setUTCHours(0, 0, 0, 0);

  const db = getDb(env);
  const dailyRows = await findEmailActivity(db, organizationId, cutoff);

  const countsMap = new Map<string, number>();
  for (const row of dailyRows) {
    countsMap.set(row.date, Number(row.count) || 0);
  }

  const daily: { date: string; count: number }[] = [];
  const cursor = new Date(cutoff);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  while (cursor <= today) {
    const dateKey = cursor.toISOString().slice(0, 10);
    daily.push({ date: dateKey, count: countsMap.get(dateKey) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { daily };
};

export const getEmailSummaryStats = async ({
  env,
  organizationId,
}: {
  env: CloudflareBindings;
  organizationId: string;
}) => {
  const db = getDb(env);
  const {
    emailCountRow,
    attachmentStatsRows,
    topDomainsRows,
    busiestInboxesRows,
    dormantInboxesRows,
  } = await findEmailSummary(db, organizationId);

  const totalEmailCount = Number(emailCountRow[0]?.count ?? 0) || 0;
  const attachmentCount =
    Number(attachmentStatsRows[0]?.attachmentCount ?? 0) || 0;
  const attachmentSizeTotal =
    Number(attachmentStatsRows[0]?.attachmentSizeTotal ?? 0) || 0;

  const topDomains = topDomainsRows
    .filter(row => row.domain && String(row.domain).length > 0)
    .map(row => ({
      domain: String(row.domain),
      count: Number(row.count) || 0,
    }));

  const busiestInboxes = busiestInboxesRows.map(row => ({
    addressId: String(row.addressId ?? ""),
    address: String(row.address ?? ""),
    count: Number(row.count) || 0,
  }));

  const dormantInboxes = dormantInboxesRows.map(row => ({
    addressId: String(row.addressId ?? ""),
    address: String(row.address ?? ""),
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  }));

  return {
    totalEmailCount,
    attachmentCount,
    attachmentSizeTotal,
    topDomains,
    busiestInboxes,
    dormantInboxes,
  };
};
