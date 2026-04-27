import type {
  AdminActivityResponse,
  AdminOperationalEvent,
  AdminOperationalEventSeverity,
  AdminOperationalEventType,
  AdminOrganizationItem,
  AdminOrganizationsResponse,
  AdminOverviewResponse,
} from "@spinupmail/contracts";
import { getDb } from "@/platform/db/client";
import {
  buildTimeZonedDailyCounts,
  getRecentDayKeys,
  resolveRequestedTimeZone,
} from "@/modules/organizations/service";
import {
  findAdminActivityRows,
  findAdminOperationalEventsPage,
  findAdminOrganizationRollups,
  findAdminOrganizationsPage,
  findAdminOverviewStats,
} from "./repo";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_QUERY_BUFFER_MS = 5 * 60 * 1000;
const ACTIVITY_WINDOW_SAFETY_DAYS = 2;
const OVERVIEW_WINDOW_DAYS = 30;
const ACTIVE_USER_24H_MS = DAY_MS;
const ACTIVE_USER_7D_MS = 7 * DAY_MS;
const ANOMALY_WINDOW_MS = DAY_MS;

const clampPagination = ({
  pageRaw,
  pageSizeRaw,
}: {
  pageRaw?: number;
  pageSizeRaw?: number;
}) => ({
  page: pageRaw && Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  pageSize:
    pageSizeRaw && Number.isInteger(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(pageSizeRaw, 100)
      : 20,
});

const toIsoString = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
};

const getTotalPages = (totalItems: number, pageSize: number) =>
  totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

const getSystemStatus = ({
  errorsLast24h,
  warningsLast24h,
  failedIntegrations,
  retryScheduled,
}: {
  errorsLast24h: number;
  warningsLast24h: number;
  failedIntegrations: number;
  retryScheduled: number;
}): AdminOverviewResponse["system"]["status"] => {
  if (errorsLast24h > 0 || failedIntegrations > 0) return "critical";
  if (warningsLast24h > 0 || retryScheduled > 0) return "warning";
  return "healthy";
};

const parseMetadata = (
  value: string | null
): Record<string, unknown> | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const getAdminOverview = async (
  env: CloudflareBindings
): Promise<AdminOverviewResponse> => {
  const now = new Date();
  const currentRange = {
    from: new Date(now.getTime() - OVERVIEW_WINDOW_DAYS * DAY_MS),
    to: now,
  };
  const previousRange = {
    from: new Date(now.getTime() - OVERVIEW_WINDOW_DAYS * 2 * DAY_MS),
    to: currentRange.from,
  };
  const stats = await findAdminOverviewStats({
    db: getDb(env),
    currentRange,
    previousRange,
    active24hSince: new Date(now.getTime() - ACTIVE_USER_24H_MS),
    active7dSince: new Date(now.getTime() - ACTIVE_USER_7D_MS),
    anomalySince: new Date(now.getTime() - ANOMALY_WINDOW_MS),
    now,
  });

  return {
    ...stats,
    system: {
      status: getSystemStatus({
        errorsLast24h: stats.anomalies.errorsLast24h,
        warningsLast24h: stats.anomalies.warningsLast24h,
        failedIntegrations: stats.integrations.failed,
        retryScheduled: stats.integrations.retryScheduled,
      }),
      checkedAt: now.toISOString(),
    },
  };
};

export const getAdminActivity = async ({
  env,
  daysRaw,
  timezoneRaw,
}: {
  env: CloudflareBindings;
  daysRaw?: number;
  timezoneRaw?: string;
}): Promise<
  | { status: 200; body: AdminActivityResponse }
  | { status: 400; body: { error: string } }
> => {
  const days = daysRaw ?? 14;
  const timezoneResult = resolveRequestedTimeZone(timezoneRaw ?? null);
  if (!timezoneResult.ok) {
    return { status: 400, body: { error: timezoneResult.error } };
  }

  const now = new Date();
  const dayKeys = getRecentDayKeys({
    days,
    now,
    timeZone: timezoneResult.timezone,
  });
  const fromInclusive = new Date(
    now.getTime() - (days + ACTIVITY_WINDOW_SAFETY_DAYS) * DAY_MS
  );
  const toExclusive = new Date(now.getTime() + ACTIVITY_QUERY_BUFFER_MS);
  const { generatedAddressRows, receivedEmailRows } =
    await findAdminActivityRows(getDb(env), fromInclusive, toExclusive);
  const generatedDaily = buildTimeZonedDailyCounts({
    dayKeys,
    minuteRows: generatedAddressRows,
    timeZone: timezoneResult.timezone,
  });
  const receivedDaily = buildTimeZonedDailyCounts({
    dayKeys,
    minuteRows: receivedEmailRows,
    timeZone: timezoneResult.timezone,
  });
  const generatedByDay = new Map(
    generatedDaily.map(item => [item.date, item.count])
  );
  const receivedByDay = new Map(
    receivedDaily.map(item => [item.date, item.count])
  );

  return {
    status: 200,
    body: {
      timezone: timezoneResult.timezone,
      daily: dayKeys.map(date => ({
        date,
        generatedAddresses: generatedByDay.get(date) ?? 0,
        receivedEmails: receivedByDay.get(date) ?? 0,
      })),
    },
  };
};

export const getAdminOrganizations = async ({
  env,
  pageRaw,
  pageSizeRaw,
}: {
  env: CloudflareBindings;
  pageRaw?: number;
  pageSizeRaw?: number;
}): Promise<AdminOrganizationsResponse> => {
  const pagination = clampPagination({ pageRaw, pageSizeRaw });
  const page = await findAdminOrganizationsPage(getDb(env), pagination);
  const organizationIds = page.items.map(item => item.id);
  const rollups = await findAdminOrganizationRollups(
    getDb(env),
    organizationIds
  );
  const memberCountByOrgId = new Map(
    rollups.memberRows.map(row => [row.organizationId, Number(row.count) || 0])
  );
  const addressRollupByOrgId = new Map(
    rollups.addressRows
      .filter(row => row.organizationId)
      .map(row => [
        String(row.organizationId),
        {
          count: Number(row.count) || 0,
          lastReceivedAt: row.lastReceivedAt,
        },
      ])
  );
  const emailRollupByOrgId = new Map(
    rollups.emailRows
      .filter(row => row.organizationId)
      .map(row => [
        String(row.organizationId),
        {
          receivedCount: Number(row.receivedCount) || 0,
          sampleCount: Number(row.sampleCount) || 0,
        },
      ])
  );
  const integrationRollupByOrgId = new Map(
    rollups.integrationRows.map(row => [
      row.organizationId,
      {
        count: Number(row.count) || 0,
        activeCount: Number(row.activeCount) || 0,
      },
    ])
  );

  const items: AdminOrganizationItem[] = page.items.map(item => {
    const addressRollup = addressRollupByOrgId.get(item.id);
    const emailRollup = emailRollupByOrgId.get(item.id);
    const integrationRollup = integrationRollupByOrgId.get(item.id);

    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      createdAt: toIsoString(item.createdAt),
      memberCount: memberCountByOrgId.get(item.id) ?? 0,
      addressCount: addressRollup?.count ?? 0,
      receivedEmailCount: emailRollup?.receivedCount ?? 0,
      sampleEmailCount: emailRollup?.sampleCount ?? 0,
      integrationCount: integrationRollup?.count ?? 0,
      activeIntegrationCount: integrationRollup?.activeCount ?? 0,
      lastReceivedAt: toIsoString(addressRollup?.lastReceivedAt),
    };
  });

  return {
    items,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems: page.totalItems,
    totalPages: getTotalPages(page.totalItems, pagination.pageSize),
  };
};

export const getAdminOperationalEvents = async ({
  env,
  pageRaw,
  pageSizeRaw,
  severity,
  type,
  organizationId,
  fromRaw,
  toRaw,
}: {
  env: CloudflareBindings;
  pageRaw?: number;
  pageSizeRaw?: number;
  severity?: AdminOperationalEventSeverity;
  type?: AdminOperationalEventType;
  organizationId?: string;
  fromRaw?: string;
  toRaw?: string;
}) => {
  const pagination = clampPagination({ pageRaw, pageSizeRaw });
  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;
  const page = await findAdminOperationalEventsPage(getDb(env), pagination, {
    severity,
    type,
    organizationId,
    from,
    to,
  });
  const items: AdminOperationalEvent[] = page.items.map(item => ({
    id: item.id,
    severity: item.severity as AdminOperationalEventSeverity,
    type: item.type as AdminOperationalEventType,
    organizationId: item.organizationId ?? null,
    addressId: item.addressId ?? null,
    emailId: item.emailId ?? null,
    integrationId: item.integrationId ?? null,
    dispatchId: item.dispatchId ?? null,
    organizationName: item.organizationName ?? null,
    message: item.message,
    metadata: parseMetadata(item.metadataJson),
    createdAt: toIsoString(item.createdAt),
  }));

  return {
    items,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems: page.totalItems,
    totalPages: getTotalPages(page.totalItems, pagination.pageSize),
  };
};
