import {
  getMaxTotalAttachmentStoragePerOrganization,
  isEmailAttachmentsEnabled,
} from "@/shared/env";
import {
  createOrganizationBodySchema,
  deleteOrganizationBodySchema,
} from "./schemas";
import { clampNumber } from "@/shared/utils/dates";
import { getDb } from "@/platform/db/client";
import { getAllowedDomains } from "@/shared/env";
import {
  clearActiveOrganizationSessions,
  findEmailActivity,
  findEmailSummary,
  findOrganizationById,
  findOrganizationCounts,
  findOrganizationIdsForUser,
} from "./repo";
import { getOrganizationMemberRole, isOrganizationOwnerRole } from "./access";
import { seedStarterInbox } from "./starter-inbox";
import { deleteR2ObjectsByPrefix } from "@/shared/utils/r2";
import { consumeFixedWindowRateLimit } from "@/shared/rate-limiter";
import { hashForRateLimitKey } from "@/shared/utils/crypto";
import type { AuthInstance, AuthSession } from "@/app/types";

const MAX_ORGANIZATION_CREATE_ATTEMPTS = 6;
const ORGANIZATION_DELETE_RATE_LIMIT_MAX = 5;
const ORGANIZATION_DELETE_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const ORGANIZATION_DELETE_RATE_LIMITER_KEY_PREFIX = "organizations:delete:user";

const DEFAULT_TIMEZONE = "UTC";
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_CURSOR_STEP_MS = 12 * 60 * 60 * 1000;
const ACTIVITY_WINDOW_SAFETY_DAYS = 2;
const ACTIVITY_QUERY_BUFFER_MS = 60 * 1000;
const DAY_KEY_FORMATTER_LOCALE = "en-US";
const DORMANT_INBOX_MIN_AGE_MS = DAY_MS;

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

const randomSlugSuffix = () => crypto.randomUUID().split("-")[0];

export const slugifyOrganizationName = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (normalized.length === 0) {
    return `org-${randomSlugSuffix()}`;
  }

  return normalized.slice(0, 48);
};

const SLUG_COLLISION_PATTERNS = [
  /\bslug (?:already exists|is taken)\b/i,
  /\borganization already exists\b/i,
  /\borganizations_slug_key\b/i,
  /\bduplicate key\b[\s\S]{0,80}\bslug\b/i,
  /\bunique constraint\b[\s\S]{0,80}\bslug\b/i,
  /\bunique violation\b[\s\S]{0,80}\bslug\b/i,
];

const isSlugCollisionError = (message: string | undefined) => {
  if (!message) return false;
  return SLUG_COLLISION_PATTERNS.some(pattern => pattern.test(message));
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
};

const getErrorStatus = (error: unknown, fallback: number) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }

  return fallback;
};

export const createOrganization = async ({
  env,
  auth,
  headers,
  session,
  payload,
}: {
  env: CloudflareBindings;
  auth: AuthInstance;
  headers: Headers;
  session: AuthSession;
  payload: unknown;
}) => {
  const parsed = createOrganizationBodySchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: 400 as const,
      body: { error: "Organization name must be between 2 and 64 characters" },
    };
  }

  const name = parsed.data.name.trim();
  const allowedDomains = getAllowedDomains(env);
  if (allowedDomains.length === 0) {
    return {
      status: 400 as const,
      body: { error: "EMAIL_DOMAINS is not configured" },
    };
  }

  const baseSlug = slugifyOrganizationName(name);

  const toOrganizationBody = (organization: {
    id: string | number;
    name: string | number;
    slug: string | number;
    logo?: unknown;
  }) => ({
    organization: {
      id: String(organization.id),
      name: String(organization.name),
      slug: String(organization.slug),
      logo: typeof organization.logo === "string" ? organization.logo : null,
    },
  });

  for (
    let attempt = 0;
    attempt < MAX_ORGANIZATION_CREATE_ATTEMPTS;
    attempt += 1
  ) {
    const suffix = attempt === 0 ? "" : `-${randomSlugSuffix().slice(0, 4)}`;
    const slug = `${baseSlug}${suffix}`.slice(0, 64);

    try {
      const organization = await auth.api.createOrganization({
        body: {
          name,
          slug,
        },
        headers,
      });

      try {
        const seeded = await seedStarterInbox({
          env,
          organizationId: String(organization.id),
          userId: session.user.id,
          organizationName: name,
        });

        console.info("[organization] Created organization starter inbox", {
          organizationId: organization.id,
          starterAddressId: seeded.starterAddressId,
          seededSampleEmailCount: seeded.seededSampleEmailCount,
          createdStarterAddress: seeded.createdStarterAddress,
        });

        return {
          status: 201 as const,
          body: {
            ...toOrganizationBody(organization),
            starterAddressId: seeded.starterAddressId,
            seededSampleEmailCount: seeded.seededSampleEmailCount,
            starterInboxProvisioned: true,
          },
        };
      } catch (error) {
        const organizationId = String(organization.id);
        const supportGuidance = `Starter inbox setup can be retried later. If it keeps failing, contact support with organization ID ${organizationId}.`;

        console.error(
          "[organization] Starter inbox provisioning failed after organization creation.",
          {
            organizationId,
            organizationName: name,
            nextStep: supportGuidance,
            error,
          }
        );

        return {
          status: 201 as const,
          body: {
            ...toOrganizationBody(organization),
            starterAddressId: null,
            seededSampleEmailCount: 0,
            starterInboxProvisioned: false,
            warning: `Starter inbox setup failed for organization ${organizationId}: ${getErrorMessage(
              error,
              "unknown error"
            )}. ${supportGuidance}`,
          },
        };
      }
    } catch (error) {
      const message = getErrorMessage(error, "Unable to create organization");
      if (isSlugCollisionError(message)) {
        continue;
      }

      console.error("[organization] Failed to create organization", {
        organizationName: name,
        attempt: attempt + 1,
        error,
      });

      return {
        status: getErrorStatus(error, 500) as 400 | 401 | 403 | 409 | 500,
        body: {
          error: /EMAIL_DOMAINS|Address limit reached/i.test(message)
            ? message
            : "Unable to create organization",
        },
      };
    }
  }

  return {
    status: 409 as const,
    body: { error: "Unable to create organization. Please try again." },
  };
};

export const deleteOrganization = async ({
  env,
  auth,
  headers,
  session,
  organizationId,
  payload,
}: {
  env: CloudflareBindings;
  auth: AuthInstance;
  headers: Headers;
  session: AuthSession;
  organizationId: string;
  payload: unknown;
}) => {
  const parsed = deleteOrganizationBodySchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: 400 as const,
      body: { error: "confirmation name is required" },
    };
  }

  const db = getDb(env);
  const organization = await findOrganizationById(db, organizationId);
  if (!organization) {
    return {
      status: 404 as const,
      body: { error: "organization not found" },
    };
  }

  const role = await getOrganizationMemberRole({
    db,
    organizationId,
    userId: session.user.id,
  });
  if (!isOrganizationOwnerRole(role)) {
    return {
      status: 403 as const,
      body: { error: "forbidden" },
    };
  }

  const userHash = await hashForRateLimitKey(session.user.id);
  const rateLimit = await consumeFixedWindowRateLimit({
    namespace: env.FIXED_WINDOW_RATE_LIMITERS,
    key: `${ORGANIZATION_DELETE_RATE_LIMITER_KEY_PREFIX}:${userHash}`,
    windowSeconds: ORGANIZATION_DELETE_RATE_LIMIT_WINDOW_SECONDS,
    maxAttempts: ORGANIZATION_DELETE_RATE_LIMIT_MAX,
  });
  if (!rateLimit.allowed) {
    return {
      status: 429 as const,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      body: {
        error: "too many organization deletion attempts",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
    };
  }

  if (parsed.data.confirmationName !== organization.name) {
    return {
      status: 400 as const,
      body: { error: "organization name confirmation does not match" },
    };
  }

  try {
    const authApi = auth.api as typeof auth.api & {
      deleteOrganization: (args: {
        body: { organizationId: string };
        headers: Headers;
      }) => Promise<unknown>;
    };

    await authApi.deleteOrganization({
      body: { organizationId },
      headers,
    });
  } catch (error) {
    console.error("[organization] Failed to delete organization", {
      organizationId,
      error,
    });
    return {
      status: getErrorStatus(error, 500) as 400 | 401 | 403 | 404 | 500,
      body: { error: "Unable to delete organization" },
    };
  }

  try {
    await clearActiveOrganizationSessions(db, organizationId);
  } catch (error) {
    console.warn(
      "[organization] Failed to clear active organization sessions",
      {
        organizationId,
        error,
      }
    );
  }

  if (env.R2_BUCKET) {
    void Promise.all([
      deleteR2ObjectsByPrefix({
        bucket: env.R2_BUCKET,
        prefix: `email-attachments/${organizationId}/`,
      }),
      deleteR2ObjectsByPrefix({
        bucket: env.R2_BUCKET,
        prefix: `email-raw/${organizationId}/`,
      }),
    ]).catch(error => {
      console.error("[organization] Failed to delete R2 objects", {
        organizationId,
        error,
      });
    });
  }

  return {
    status: 200 as const,
    body: {
      id: organizationId,
      deleted: true,
    },
  };
};

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
  const attachmentSizeLimit = attachmentsEnabled
    ? getMaxTotalAttachmentStoragePerOrganization(env)
    : 0;

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
    attachmentSizeLimit,
    topDomains,
    busiestInboxes,
    dormantInboxes,
  };
};
