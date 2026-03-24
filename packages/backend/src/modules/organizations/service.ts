import { isEmailAttachmentsEnabled } from "@/shared/env";
import { clampNumber } from "@/shared/utils/dates";
import { getDb } from "@/platform/db/client";
import {
  findEmailActivity,
  findEmailSummary,
  findOrganizationCounts,
  findOrganizationIdsForUser,
} from "./repo";

const DEFAULT_TIMEZONE = "UTC";
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_CURSOR_STEP_MS = 12 * 60 * 60 * 1000;
const ACTIVITY_WINDOW_SAFETY_DAYS = 2;
const ACTIVITY_QUERY_BUFFER_MS = 60 * 1000;
const DAY_KEY_FORMATTER_LOCALE = "en-US";
const DORMANT_INBOX_MIN_AGE_MS = DAY_MS;

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

const getDayKeyFormatter = (timeZone: string) => {
  const cached = dayKeyFormatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(DAY_KEY_FORMATTER_LOCALE, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  dayKeyFormatters.set(timeZone, formatter);
  return formatter;
};

export const getDayKeyInTimeZone = (value: number | Date, timeZone: string) => {
  const formatter = getDayKeyFormatter(timeZone);
  const date = value instanceof Date ? value : new Date(value);
  const parts = formatter.formatToParts(date);
  const year = parts.find(part => part.type === "year")?.value ?? "0000";
  const month = parts.find(part => part.type === "month")?.value ?? "01";
  const day = parts.find(part => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
};

const isValidTimeZone = (value: string) => {
  try {
    Intl.DateTimeFormat(DAY_KEY_FORMATTER_LOCALE, { timeZone: value }).format(
      new Date()
    );
    return true;
  } catch {
    return false;
  }
};

export const resolveRequestedTimeZone = (timezoneRaw: string | null) => {
  const candidate = timezoneRaw?.trim();
  if (!candidate) {
    return {
      ok: true as const,
      timezone: DEFAULT_TIMEZONE,
    };
  }
  if (!isValidTimeZone(candidate)) {
    return {
      ok: false as const,
      error: "invalid timezone",
    };
  }
  return {
    ok: true as const,
    timezone: candidate,
  };
};

export const getRecentDayKeys = ({
  days,
  now,
  timeZone,
}: {
  days: number;
  now: Date;
  timeZone: string;
}) => {
  const keysDescending: string[] = [];
  const seen = new Set<string>();
  let cursorMs = now.getTime();
  let attempts = 0;
  const maxAttempts = days * 12;

  while (keysDescending.length < days && attempts < maxAttempts) {
    const key = getDayKeyInTimeZone(cursorMs, timeZone);
    if (!seen.has(key)) {
      seen.add(key);
      keysDescending.push(key);
    }
    cursorMs -= DAY_CURSOR_STEP_MS;
    attempts += 1;
  }

  return keysDescending.reverse();
};

export const buildTimeZonedDailyCounts = ({
  dayKeys,
  minuteRows,
  timeZone,
}: {
  dayKeys: string[];
  minuteRows: Array<{ minuteStartMs: number; count: number }>;
  timeZone: string;
}) => {
  const dayKeySet = new Set(dayKeys);
  const countByDay = new Map<string, number>();
  for (const dayKey of dayKeys) {
    countByDay.set(dayKey, 0);
  }

  for (const row of minuteRows) {
    const minuteStartMs = Number(row.minuteStartMs);
    if (!Number.isFinite(minuteStartMs)) continue;
    const dayKey = getDayKeyInTimeZone(minuteStartMs, timeZone);
    if (!dayKeySet.has(dayKey)) continue;
    countByDay.set(dayKey, (countByDay.get(dayKey) ?? 0) + (row.count || 0));
  }

  return dayKeys.map(dayKey => ({
    date: dayKey,
    count: countByDay.get(dayKey) ?? 0,
  }));
};

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
  timezoneRaw,
}: {
  env: CloudflareBindings;
  organizationId: string;
  daysRaw: string | null;
  timezoneRaw: string | null;
}) => {
  const days = clampNumber(daysRaw, 1, 30, 14);
  const timezoneResult = resolveRequestedTimeZone(timezoneRaw);
  if (!timezoneResult.ok) {
    return {
      status: 400 as const,
      body: { error: timezoneResult.error },
    };
  }
  const timezone = timezoneResult.timezone;
  const now = new Date();
  const dayKeys = getRecentDayKeys({
    days,
    now,
    timeZone: timezone,
  });
  const fromInclusive = new Date(
    now.getTime() - (days + ACTIVITY_WINDOW_SAFETY_DAYS) * DAY_MS
  );
  const toExclusive = new Date(now.getTime() + ACTIVITY_QUERY_BUFFER_MS);

  const db = getDb(env);
  const minuteRows = await findEmailActivity(
    db,
    organizationId,
    fromInclusive,
    toExclusive
  );
  const daily = buildTimeZonedDailyCounts({
    dayKeys,
    minuteRows,
    timeZone: timezone,
  });

  return {
    status: 200 as const,
    body: {
      timezone,
      daily,
    },
  };
};

export const getEmailSummaryStats = async ({
  env,
  organizationId,
}: {
  env: CloudflareBindings;
  organizationId: string;
}) => {
  const dormantInboxCreatedBefore = new Date(
    Date.now() - DORMANT_INBOX_MIN_AGE_MS
  );
  const db = getDb(env);
  const {
    emailCountRow,
    attachmentStatsRows,
    topDomainsRows,
    busiestInboxesRows,
    dormantInboxesRows,
  } = await findEmailSummary(db, organizationId, dormantInboxCreatedBefore);
  const attachmentsEnabled = isEmailAttachmentsEnabled(env);

  const totalEmailCount = Number(emailCountRow[0]?.count ?? 0) || 0;
  const attachmentCount = attachmentsEnabled
    ? Number(attachmentStatsRows[0]?.attachmentCount ?? 0) || 0
    : 0;
  const attachmentSizeTotal = attachmentsEnabled
    ? Number(attachmentStatsRows[0]?.attachmentSizeTotal ?? 0) || 0
    : 0;

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

  const dormantInboxes = dormantInboxesRows
    .filter(row => {
      if (!row.createdAt) return false;
      return row.createdAt.getTime() <= dormantInboxCreatedBefore.getTime();
    })
    .map(row => ({
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
