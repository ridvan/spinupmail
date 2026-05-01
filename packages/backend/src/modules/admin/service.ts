import type {
  AdminActivityResponse,
  AdminApiKeysResponse,
  AdminOperationalEvent,
  AdminOperationalEventSeverity,
  AdminOperationalEventType,
  AdminOrganizationDetailResponse,
  AdminOrganizationItem,
  AdminOrganizationsResponse,
  AdminOverviewResponse,
  AdminRecordAuditEventRequest,
  AdminUserActionRequest,
  AdminUserDetailResponse,
  PlatformRole,
} from "@spinupmail/contracts";
import { eq } from "drizzle-orm";
import { sessions, users } from "@/db";
import { getDb } from "@/platform/db/client";
import {
  buildTimeZonedDailyCounts,
  getRecentDayKeys,
  resolveRequestedTimeZone,
} from "@/modules/organizations/service";
import {
  findAdminActivityRows,
  findAdminApiKeysPage,
  findAdminOperationalEventsPage,
  findAdminOrganizationDetail,
  findAdminOrganizationRollups,
  findAdminOrganizationsPage,
  findAdminOverviewStats,
  findAdminUserDetail,
} from "./repo";
import { recordOperationalEvent } from "./operational-events";

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
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

const parseRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return null;
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

const mapOperationalEvent = (item: {
  id: string;
  severity: string;
  type: string;
  organizationId: string | null;
  addressId: string | null;
  emailId: string | null;
  integrationId: string | null;
  dispatchId: string | null;
  organizationName: string | null;
  message: string;
  metadataJson: string | null;
  createdAt: unknown;
}): AdminOperationalEvent => ({
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
});

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
  const items: AdminOperationalEvent[] = page.items.map(mapOperationalEvent);

  return {
    items,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems: page.totalItems,
    totalPages: getTotalPages(page.totalItems, pagination.pageSize),
  };
};

export const getAdminUserDetail = async ({
  env,
  userId,
}: {
  env: CloudflareBindings;
  userId: string;
}): Promise<
  | { status: 200; body: AdminUserDetailResponse }
  | { status: 404; body: { error: string } }
> => {
  const detail = await findAdminUserDetail(getDb(env), userId);
  if (!detail.user) return { status: 404, body: { error: "user not found" } };

  return {
    status: 200,
    body: {
      user: {
        id: detail.user.id,
        name: detail.user.name ?? null,
        email: detail.user.email,
        emailVerified: detail.user.emailVerified === true,
        role: detail.user.role ?? null,
        banned: detail.user.banned ?? null,
        banReason: detail.user.banReason ?? null,
        banExpires: toIsoString(detail.user.banExpires),
        twoFactorEnabled: detail.user.twoFactorEnabled ?? null,
        timezone: detail.user.timezone ?? null,
        createdAt: toIsoString(detail.user.createdAt),
        updatedAt: toIsoString(detail.user.updatedAt),
      },
      accounts: detail.accounts.map(account => ({
        providerId: account.providerId,
        createdAt: toIsoString(account.createdAt),
      })),
      memberships: detail.memberships.map(membership => ({
        organizationId: membership.organizationId,
        organizationName: membership.organizationName ?? null,
        organizationSlug: membership.organizationSlug ?? null,
        role: membership.role,
        createdAt: toIsoString(membership.createdAt),
      })),
      apiKeys: detail.apiKeys.map(key => ({
        id: key.id,
        name: key.name ?? null,
        start: key.start ?? null,
        prefix: key.prefix ?? null,
        enabled: key.enabled ?? null,
        requestCount: Number(key.requestCount ?? 0) || 0,
        remaining: key.remaining ?? null,
        rateLimitEnabled: key.rateLimitEnabled ?? null,
        rateLimitMax: key.rateLimitMax ?? null,
        rateLimitTimeWindow: key.rateLimitTimeWindow ?? null,
        lastRequest: toIsoString(key.lastRequest),
        expiresAt: toIsoString(key.expiresAt),
        createdAt: toIsoString(key.createdAt),
        metadata: parseRecord(key.metadata),
      })),
      recentEvents: detail.recentEvents.map(mapOperationalEvent),
    },
  };
};

export const getAdminOrganizationDetail = async ({
  env,
  organizationId,
}: {
  env: CloudflareBindings;
  organizationId: string;
}): Promise<
  | { status: 200; body: AdminOrganizationDetailResponse }
  | { status: 404; body: { error: string } }
> => {
  const detail = await findAdminOrganizationDetail(getDb(env), organizationId);
  if (!detail.organization) {
    return { status: 404, body: { error: "organization not found" } };
  }

  const rollups = await findAdminOrganizationRollups(getDb(env), [
    organizationId,
  ]);
  const addressRollup = rollups.addressRows[0];
  const emailRollup = rollups.emailRows[0];
  const integrationRollup = rollups.integrationRows[0];
  const memberRollup = rollups.memberRows[0];

  return {
    status: 200,
    body: {
      organization: {
        id: detail.organization.id,
        name: detail.organization.name,
        slug: detail.organization.slug,
        createdAt: toIsoString(detail.organization.createdAt),
        metadata: parseRecord(detail.organization.metadata),
        memberCount: Number(memberRollup?.count ?? 0) || 0,
        addressCount: Number(addressRollup?.count ?? 0) || 0,
        receivedEmailCount: Number(emailRollup?.receivedCount ?? 0) || 0,
        sampleEmailCount: Number(emailRollup?.sampleCount ?? 0) || 0,
        integrationCount: Number(integrationRollup?.count ?? 0) || 0,
        activeIntegrationCount:
          Number(integrationRollup?.activeCount ?? 0) || 0,
        lastReceivedAt: toIsoString(addressRollup?.lastReceivedAt),
      },
      members: detail.members.map(member => ({
        id: member.id,
        userId: member.userId,
        name: member.name ?? null,
        email: member.email ?? null,
        role: member.role,
        createdAt: toIsoString(member.createdAt),
      })),
      invitations: detail.invitations.map(invitation => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role ?? null,
        status: invitation.status,
        expiresAt: toIsoString(invitation.expiresAt),
        createdAt: toIsoString(invitation.createdAt),
      })),
      integrations: detail.integrations.map(integration => ({
        id: integration.id,
        provider: integration.provider,
        name: integration.name,
        status: integration.status,
        lastValidatedAt: toIsoString(integration.lastValidatedAt),
        createdAt: toIsoString(integration.createdAt),
        updatedAt: toIsoString(integration.updatedAt),
      })),
      apiKeys: detail.apiKeys.map(key => ({
        id: key.id,
        name: key.name ?? null,
        start: key.start ?? null,
        prefix: key.prefix ?? null,
        enabled: key.enabled ?? null,
        requestCount: Number(key.requestCount ?? 0) || 0,
        remaining: key.remaining ?? null,
        lastRequest: toIsoString(key.lastRequest),
        expiresAt: toIsoString(key.expiresAt),
        createdAt: toIsoString(key.createdAt),
        metadata: parseRecord(key.metadata),
      })),
      recentEvents: detail.recentEvents.map(mapOperationalEvent),
    },
  };
};

export const getAdminApiKeys = async ({
  env,
  pageRaw,
  pageSizeRaw,
}: {
  env: CloudflareBindings;
  pageRaw?: number;
  pageSizeRaw?: number;
}): Promise<AdminApiKeysResponse> => {
  const pagination = clampPagination({ pageRaw, pageSizeRaw });
  const page = await findAdminApiKeysPage(getDb(env), pagination);

  return {
    items: page.items.map(item => {
      const ownerType = item.userEmail
        ? "user"
        : item.organizationName
          ? "organization"
          : "unknown";
      const ownerLabel =
        item.userEmail ??
        item.organizationName ??
        item.organizationSlug ??
        null;

      return {
        id: item.id,
        name: item.name ?? null,
        start: item.start ?? null,
        prefix: item.prefix ?? null,
        referenceId: item.referenceId,
        ownerType,
        ownerLabel,
        enabled: item.enabled ?? null,
        requestCount: Number(item.requestCount ?? 0) || 0,
        remaining: item.remaining ?? null,
        rateLimitEnabled: item.rateLimitEnabled ?? null,
        rateLimitMax: item.rateLimitMax ?? null,
        rateLimitTimeWindow: item.rateLimitTimeWindow ?? null,
        lastRequest: toIsoString(item.lastRequest),
        expiresAt: toIsoString(item.expiresAt),
        createdAt: toIsoString(item.createdAt),
        metadata: parseRecord(item.metadata),
      };
    }),
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems: page.totalItems,
    totalPages: getTotalPages(page.totalItems, pagination.pageSize),
  };
};

export const recordAdminAuditEvent = async ({
  env,
  actorUserId,
  actorEmail,
  input,
}: {
  env: CloudflareBindings;
  actorUserId: string;
  actorEmail?: string | null;
  input: AdminRecordAuditEventRequest;
}) => {
  await recordOperationalEvent({
    env,
    severity: "info",
    type:
      input.targetType === "session"
        ? "admin_session_action"
        : input.action === "impersonate-user"
          ? "admin_impersonation_started"
          : "admin_user_action",
    organizationId: input.organizationId ?? null,
    message: input.message,
    metadata: {
      ...(input.metadata ?? {}),
      actorUserId,
      actorEmail: actorEmail ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      reason: input.reason ?? null,
    },
  });

  return { ok: true };
};

const roleIncludes = (role: unknown, expected: PlatformRole) => {
  if (Array.isArray(role)) {
    return role.some(value => String(value).trim() === expected);
  }
  if (typeof role !== "string") return false;
  return role.split(",").some(part => part.trim() === expected);
};

const requireAdminActionPermission = ({
  actorRole,
}: {
  actorRole: unknown;
}) => {
  if (roleIncludes(actorRole, "admin")) return;

  throw new AdminActionError(403, "forbidden");
};

class AdminActionError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 500,
    message: string
  ) {
    super(message);
  }
}

class AdminActionResponse extends Error {
  constructor(readonly response: Response) {
    super("admin action response");
  }
}

const getAdminActionMessage = (
  input: AdminUserActionRequest,
  targetEmail: string | null
) => {
  const label = targetEmail ?? "user";
  if (input.action === "set-role") return `Set ${label} role to ${input.role}.`;
  if (input.action === "ban") return `Banned ${label}.`;
  if (input.action === "unban") return `Unbanned ${label}.`;
  if (input.action === "impersonate")
    return `Started impersonation for ${label}.`;
  if (input.action === "revoke-session")
    return `Revoked one session for ${label}.`;
  return `Revoked sessions for ${label}.`;
};

const getAdminActionAuditType = (
  input: AdminUserActionRequest
): AdminRecordAuditEventRequest["targetType"] =>
  input.action === "revoke-session" || input.action === "revoke-sessions"
    ? "session"
    : "user";

const getAdminActionEventType = (
  input: AdminUserActionRequest
): AdminOperationalEventType =>
  input.action === "impersonate"
    ? "admin_impersonation_started"
    : input.action === "revoke-session" || input.action === "revoke-sessions"
      ? "admin_session_action"
      : "admin_user_action";

export const performAdminUserAction = async ({
  env,
  runImpersonation,
  actorUserId,
  actorEmail,
  actorRole,
  input,
}: {
  env: CloudflareBindings;
  runImpersonation?: () => Promise<Response>;
  actorUserId: string;
  actorEmail?: string | null;
  actorRole: unknown;
  input: AdminUserActionRequest;
}) => {
  requireAdminActionPermission({ actorRole });

  const db = getDb(env);
  const targetUser = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .get();

  if (!targetUser) throw new AdminActionError(404, "user not found");

  let actionResponse: Response | null = null;

  if (input.action === "set-role") {
    await db
      .update(users)
      .set({ role: input.role, updatedAt: new Date() })
      .where(eq(users.id, input.userId));
  } else if (input.action === "ban") {
    if (input.userId === actorUserId) {
      throw new AdminActionError(400, "cannot ban yourself");
    }
    await db
      .update(users)
      .set({
        banned: true,
        banReason: input.reason?.trim() || "Administrative action",
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId));
    await db.delete(sessions).where(eq(sessions.userId, input.userId));
  } else if (input.action === "unban") {
    await db
      .update(users)
      .set({
        banned: false,
        banReason: null,
        banExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, input.userId));
  } else if (input.action === "revoke-sessions") {
    await db.delete(sessions).where(eq(sessions.userId, input.userId));
  } else if (input.action === "revoke-session") {
    const session = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.token, input.sessionToken))
      .get();
    if (session?.userId && session.userId !== input.userId) {
      throw new AdminActionError(400, "session does not belong to user");
    }
    await db.delete(sessions).where(eq(sessions.token, input.sessionToken));
  } else {
    const impersonationResponse = await runImpersonation?.();
    if (!impersonationResponse) {
      throw new AdminActionError(500, "unable to impersonate user");
    }
    if (!impersonationResponse.ok) {
      throw new AdminActionResponse(impersonationResponse);
    }
    actionResponse = impersonationResponse;
  }

  await recordOperationalEvent({
    env,
    severity: "info",
    type: getAdminActionEventType(input),
    message: getAdminActionMessage(input, targetUser.email),
    metadata: {
      ...(input.action === "set-role" ? { role: input.role } : {}),
      actorUserId,
      actorEmail: actorEmail ?? null,
      action: input.action,
      targetType: getAdminActionAuditType(input),
      targetId: input.userId,
      reason: input.reason?.trim() || null,
    },
  });

  return actionResponse ?? { ok: true };
};

export const getAdminActionErrorResponse = (error: unknown) => {
  if (error instanceof AdminActionResponse) {
    return { response: error.response };
  }
  if (error instanceof AdminActionError) {
    return {
      status: error.status,
      body: { error: error.message },
    };
  }
  return null;
};
