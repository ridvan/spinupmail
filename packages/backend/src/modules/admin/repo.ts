import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import {
  emailAddresses,
  emailAttachments,
  emails,
  integrationDispatches,
  accounts,
  apikeys,
  invitations,
  members,
  operationalEvents,
  organizationIntegrations,
  organizations,
  sessions,
  users,
} from "@/db";
import type { AppDb } from "@/platform/db/client";
import type {
  AdminOperationalEventSeverity,
  AdminOperationalEventType,
} from "@spinupmail/contracts";

type DateRange = {
  from: Date;
  to: Date;
};

const ADMIN_AUDIT_EVENT_TYPES = [
  "admin_user_action",
  "admin_session_action",
  "admin_impersonation_started",
] as const satisfies readonly AdminOperationalEventType[];

export const findAdminUserDetail = async (db: AppDb, userId: string) => {
  const [user, accountRows, membershipRows, apiKeyRows, recentEventRows] =
    await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          emailVerified: users.emailVerified,
          role: users.role,
          banned: users.banned,
          banReason: users.banReason,
          banExpires: users.banExpires,
          twoFactorEnabled: users.twoFactorEnabled,
          timezone: users.timezone,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .get(),
      db
        .select({
          providerId: accounts.providerId,
          createdAt: accounts.createdAt,
        })
        .from(accounts)
        .where(eq(accounts.userId, userId))
        .orderBy(desc(accounts.createdAt)),
      db
        .select({
          organizationId: members.organizationId,
          organizationName: organizations.name,
          organizationSlug: organizations.slug,
          role: members.role,
          createdAt: members.createdAt,
        })
        .from(members)
        .leftJoin(organizations, eq(organizations.id, members.organizationId))
        .where(eq(members.userId, userId))
        .orderBy(desc(members.createdAt)),
      db
        .select({
          id: apikeys.id,
          name: apikeys.name,
          start: apikeys.start,
          prefix: apikeys.prefix,
          enabled: apikeys.enabled,
          requestCount: apikeys.requestCount,
          remaining: apikeys.remaining,
          rateLimitEnabled: apikeys.rateLimitEnabled,
          rateLimitMax: apikeys.rateLimitMax,
          rateLimitTimeWindow: apikeys.rateLimitTimeWindow,
          lastRequest: apikeys.lastRequest,
          expiresAt: apikeys.expiresAt,
          createdAt: apikeys.createdAt,
          metadata: apikeys.metadata,
        })
        .from(apikeys)
        .where(eq(apikeys.referenceId, userId))
        .orderBy(desc(apikeys.createdAt)),
      db
        .select({
          id: operationalEvents.id,
          severity: operationalEvents.severity,
          type: operationalEvents.type,
          organizationId: operationalEvents.organizationId,
          addressId: operationalEvents.addressId,
          emailId: operationalEvents.emailId,
          integrationId: operationalEvents.integrationId,
          dispatchId: operationalEvents.dispatchId,
          organizationName: organizations.name,
          message: operationalEvents.message,
          metadataJson: operationalEvents.metadataJson,
          createdAt: operationalEvents.createdAt,
        })
        .from(operationalEvents)
        .leftJoin(
          organizations,
          eq(organizations.id, operationalEvents.organizationId)
        )
        .where(
          and(
            inArray(operationalEvents.type, ADMIN_AUDIT_EVENT_TYPES),
            sql`json_extract(${operationalEvents.metadataJson}, '$.targetId') = ${userId}`
          )
        )
        .orderBy(desc(operationalEvents.createdAt))
        .limit(10),
    ]);

  return {
    user,
    accounts: accountRows,
    memberships: membershipRows,
    apiKeys: apiKeyRows,
    recentEvents: recentEventRows,
  };
};

export const findAdminOrganizationDetail = async (
  db: AppDb,
  organizationId: string
) => {
  const [
    organization,
    memberRows,
    invitationRows,
    integrationRows,
    apiKeyRows,
    recentEventRows,
  ] = await Promise.all([
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        createdAt: organizations.createdAt,
        metadata: organizations.metadata,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .get(),
    db
      .select({
        id: members.id,
        userId: members.userId,
        name: users.name,
        email: users.email,
        role: members.role,
        createdAt: members.createdAt,
      })
      .from(members)
      .leftJoin(users, eq(users.id, members.userId))
      .where(eq(members.organizationId, organizationId))
      .orderBy(desc(members.createdAt)),
    db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .where(eq(invitations.organizationId, organizationId))
      .orderBy(desc(invitations.createdAt)),
    db
      .select({
        id: organizationIntegrations.id,
        provider: organizationIntegrations.provider,
        name: organizationIntegrations.name,
        status: organizationIntegrations.status,
        lastValidatedAt: organizationIntegrations.lastValidatedAt,
        createdAt: organizationIntegrations.createdAt,
        updatedAt: organizationIntegrations.updatedAt,
      })
      .from(organizationIntegrations)
      .where(eq(organizationIntegrations.organizationId, organizationId))
      .orderBy(desc(organizationIntegrations.createdAt)),
    db
      .select({
        id: apikeys.id,
        name: apikeys.name,
        start: apikeys.start,
        prefix: apikeys.prefix,
        enabled: apikeys.enabled,
        requestCount: apikeys.requestCount,
        remaining: apikeys.remaining,
        lastRequest: apikeys.lastRequest,
        expiresAt: apikeys.expiresAt,
        createdAt: apikeys.createdAt,
        metadata: apikeys.metadata,
      })
      .from(apikeys)
      .where(eq(apikeys.referenceId, organizationId))
      .orderBy(desc(apikeys.createdAt)),
    db
      .select({
        id: operationalEvents.id,
        severity: operationalEvents.severity,
        type: operationalEvents.type,
        organizationId: operationalEvents.organizationId,
        addressId: operationalEvents.addressId,
        emailId: operationalEvents.emailId,
        integrationId: operationalEvents.integrationId,
        dispatchId: operationalEvents.dispatchId,
        organizationName: organizations.name,
        message: operationalEvents.message,
        metadataJson: operationalEvents.metadataJson,
        createdAt: operationalEvents.createdAt,
      })
      .from(operationalEvents)
      .leftJoin(
        organizations,
        eq(organizations.id, operationalEvents.organizationId)
      )
      .where(eq(operationalEvents.organizationId, organizationId))
      .orderBy(desc(operationalEvents.createdAt))
      .limit(10),
  ]);

  return {
    organization,
    members: memberRows,
    invitations: invitationRows,
    integrations: integrationRows,
    apiKeys: apiKeyRows,
    recentEvents: recentEventRows,
  };
};

export const findAdminApiKeysPage = async (
  db: AppDb,
  { page, pageSize }: Pagination
) => {
  const offset = (page - 1) * pageSize;
  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: apikeys.id,
        name: apikeys.name,
        start: apikeys.start,
        prefix: apikeys.prefix,
        referenceId: apikeys.referenceId,
        enabled: apikeys.enabled,
        requestCount: apikeys.requestCount,
        remaining: apikeys.remaining,
        rateLimitEnabled: apikeys.rateLimitEnabled,
        rateLimitMax: apikeys.rateLimitMax,
        rateLimitTimeWindow: apikeys.rateLimitTimeWindow,
        lastRequest: apikeys.lastRequest,
        expiresAt: apikeys.expiresAt,
        createdAt: apikeys.createdAt,
        metadata: apikeys.metadata,
        userName: users.name,
        userEmail: users.email,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
      })
      .from(apikeys)
      .leftJoin(users, eq(users.id, apikeys.referenceId))
      .leftJoin(organizations, eq(organizations.id, apikeys.referenceId))
      .orderBy(desc(apikeys.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(apikeys),
  ]);

  return {
    items,
    totalItems: getFirstCount(totalRows),
  };
};

type Pagination = {
  page: number;
  pageSize: number;
};

type AnomalyFilters = {
  severity?: AdminOperationalEventSeverity;
  type?: AdminOperationalEventType;
  organizationId?: string;
  from?: Date;
  to?: Date;
};

const getFirstCount = (rows: Array<{ count: number }>) =>
  Number(rows[0]?.count ?? 0) || 0;

const countAddressRows = (db: AppDb, range: DateRange) =>
  db
    .select({ count: sql<number>`count(*)` })
    .from(emailAddresses)
    .where(
      and(
        gte(emailAddresses.createdAt, range.from),
        lt(emailAddresses.createdAt, range.to)
      )
    );

const countEmailRows = (db: AppDb, range: DateRange, isSample: boolean) =>
  db
    .select({ count: sql<number>`count(*)` })
    .from(emails)
    .where(
      and(
        eq(emails.isSample, isSample),
        gte(emails.receivedAt, range.from),
        lt(emails.receivedAt, range.to)
      )
    );

const countActiveUsersSince = (db: AppDb, since: Date, now: Date) =>
  db
    .select({ count: sql<number>`count(distinct ${sessions.userId})` })
    .from(sessions)
    .where(and(gte(sessions.updatedAt, since), gte(sessions.expiresAt, now)));

export const findAdminOverviewStats = async ({
  db,
  currentRange,
  previousRange,
  active24hSince,
  active7dSince,
  anomalySince,
  now,
}: {
  db: AppDb;
  currentRange: DateRange;
  previousRange: DateRange;
  active24hSince: Date;
  active7dSince: Date;
  anomalySince: Date;
  now: Date;
}) => {
  const [
    generatedCurrentRows,
    generatedPreviousRows,
    receivedCurrentRows,
    receivedPreviousRows,
    sampleCurrentRows,
    samplePreviousRows,
    organizationRows,
    userRows,
    active24hRows,
    active7dRows,
    attachmentRows,
    activeIntegrationRows,
    retryDispatchRows,
    failedDispatchRows,
    anomalyRows,
    errorAnomalyRows,
    warningAnomalyRows,
  ] = await Promise.all([
    countAddressRows(db, currentRange),
    countAddressRows(db, previousRange),
    countEmailRows(db, currentRange, false),
    countEmailRows(db, previousRange, false),
    countEmailRows(db, currentRange, true),
    countEmailRows(db, previousRange, true),
    db.select({ count: sql<number>`count(*)` }).from(organizations),
    db.select({ count: sql<number>`count(*)` }).from(users),
    countActiveUsersSince(db, active24hSince, now),
    countActiveUsersSince(db, active7dSince, now),
    db
      .select({
        count: sql<number>`count(*)`,
        sizeTotal: sql<number>`coalesce(sum(${emailAttachments.size}), 0)`,
      })
      .from(emailAttachments),
    db
      .select({ count: sql<number>`count(*)` })
      .from(organizationIntegrations)
      .where(eq(organizationIntegrations.status, "active")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(integrationDispatches)
      .where(eq(integrationDispatches.status, "retry_scheduled")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(integrationDispatches)
      .where(
        inArray(integrationDispatches.status, [
          "failed_permanent",
          "failed_dlq",
        ])
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(operationalEvents)
      .where(
        and(
          gte(operationalEvents.createdAt, anomalySince),
          inArray(operationalEvents.severity, ["warning", "error"])
        )
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(operationalEvents)
      .where(
        and(
          eq(operationalEvents.severity, "error"),
          gte(operationalEvents.createdAt, anomalySince)
        )
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(operationalEvents)
      .where(
        and(
          eq(operationalEvents.severity, "warning"),
          gte(operationalEvents.createdAt, anomalySince)
        )
      ),
  ]);

  return {
    generatedAddresses: {
      current: getFirstCount(generatedCurrentRows),
      previous: getFirstCount(generatedPreviousRows),
    },
    receivedEmails: {
      current: getFirstCount(receivedCurrentRows),
      previous: getFirstCount(receivedPreviousRows),
    },
    sampleEmails: {
      current: getFirstCount(sampleCurrentRows),
      previous: getFirstCount(samplePreviousRows),
    },
    organizations: getFirstCount(organizationRows),
    users: getFirstCount(userRows),
    activeUsers24h: getFirstCount(active24hRows),
    activeUsers7d: getFirstCount(active7dRows),
    attachments: {
      count: Number(attachmentRows[0]?.count ?? 0) || 0,
      sizeTotal: Number(attachmentRows[0]?.sizeTotal ?? 0) || 0,
    },
    integrations: {
      active: getFirstCount(activeIntegrationRows),
      retryScheduled: getFirstCount(retryDispatchRows),
      failed: getFirstCount(failedDispatchRows),
    },
    anomalies: {
      last24h: getFirstCount(anomalyRows),
      errorsLast24h: getFirstCount(errorAnomalyRows),
      warningsLast24h: getFirstCount(warningAnomalyRows),
    },
  };
};

export const findAdminActivityRows = async (
  db: AppDb,
  fromInclusive: Date,
  toExclusive: Date
) => {
  const addressMinuteExpr = sql<number>`cast(${emailAddresses.createdAt} / 60000 as integer) * 60000`;
  const emailMinuteExpr = sql<number>`cast(${emails.receivedAt} / 60000 as integer) * 60000`;

  const [generatedAddressRows, receivedEmailRows] = await Promise.all([
    db
      .select({
        minuteStartMs: addressMinuteExpr,
        count: sql<number>`count(*)`,
      })
      .from(emailAddresses)
      .where(
        and(
          gte(emailAddresses.createdAt, fromInclusive),
          lt(emailAddresses.createdAt, toExclusive)
        )
      )
      .groupBy(addressMinuteExpr)
      .orderBy(asc(addressMinuteExpr)),
    db
      .select({
        minuteStartMs: emailMinuteExpr,
        count: sql<number>`count(*)`,
      })
      .from(emails)
      .where(
        and(
          eq(emails.isSample, false),
          gte(emails.receivedAt, fromInclusive),
          lt(emails.receivedAt, toExclusive)
        )
      )
      .groupBy(emailMinuteExpr)
      .orderBy(asc(emailMinuteExpr)),
  ]);

  return { generatedAddressRows, receivedEmailRows };
};

export const findAdminOrganizationsPage = async (
  db: AppDb,
  { page, pageSize }: Pagination
) => {
  const offset = (page - 1) * pageSize;
  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .orderBy(desc(organizations.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(organizations),
  ]);

  return {
    items,
    totalItems: getFirstCount(totalRows),
  };
};

export const findAdminOrganizationRollups = async (
  db: AppDb,
  organizationIds: string[]
) => {
  if (organizationIds.length === 0) {
    return {
      memberRows: [],
      addressRows: [],
      emailRows: [],
      integrationRows: [],
    };
  }

  const [memberRows, addressRows, emailRows, integrationRows] =
    await Promise.all([
      db
        .select({
          organizationId: members.organizationId,
          count: sql<number>`count(*)`,
        })
        .from(members)
        .where(inArray(members.organizationId, organizationIds))
        .groupBy(members.organizationId),
      db
        .select({
          organizationId: emailAddresses.organizationId,
          count: sql<number>`count(*)`,
          lastReceivedAt: sql<Date | null>`max(${emailAddresses.lastReceivedAt})`,
        })
        .from(emailAddresses)
        .where(inArray(emailAddresses.organizationId, organizationIds))
        .groupBy(emailAddresses.organizationId),
      db
        .select({
          organizationId: emailAddresses.organizationId,
          receivedCount: sql<number>`sum(case when ${emails.isSample} = 0 then 1 else 0 end)`,
          sampleCount: sql<number>`sum(case when ${emails.isSample} = 1 then 1 else 0 end)`,
        })
        .from(emails)
        .innerJoin(emailAddresses, eq(emails.addressId, emailAddresses.id))
        .where(inArray(emailAddresses.organizationId, organizationIds))
        .groupBy(emailAddresses.organizationId),
      db
        .select({
          organizationId: organizationIntegrations.organizationId,
          count: sql<number>`count(*)`,
          activeCount: sql<number>`sum(case when ${organizationIntegrations.status} = 'active' then 1 else 0 end)`,
        })
        .from(organizationIntegrations)
        .where(
          inArray(organizationIntegrations.organizationId, organizationIds)
        )
        .groupBy(organizationIntegrations.organizationId),
    ]);

  return { memberRows, addressRows, emailRows, integrationRows };
};

const buildAnomalyWhere = (filters: AnomalyFilters) => {
  const conditions = [];
  if (filters.severity) {
    conditions.push(eq(operationalEvents.severity, filters.severity));
  }
  if (filters.type) {
    conditions.push(eq(operationalEvents.type, filters.type));
  }
  if (filters.organizationId) {
    conditions.push(
      eq(operationalEvents.organizationId, filters.organizationId)
    );
  }
  if (filters.from) {
    conditions.push(gte(operationalEvents.createdAt, filters.from));
  }
  if (filters.to) {
    conditions.push(lt(operationalEvents.createdAt, filters.to));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
};

export const findAdminOperationalEventsPage = async (
  db: AppDb,
  pagination: Pagination,
  filters: AnomalyFilters
) => {
  const offset = (pagination.page - 1) * pagination.pageSize;
  const where = buildAnomalyWhere(filters);

  const [items, totalRows] = await Promise.all([
    db
      .select({
        id: operationalEvents.id,
        severity: operationalEvents.severity,
        type: operationalEvents.type,
        organizationId: operationalEvents.organizationId,
        addressId: operationalEvents.addressId,
        emailId: operationalEvents.emailId,
        integrationId: operationalEvents.integrationId,
        dispatchId: operationalEvents.dispatchId,
        organizationName: organizations.name,
        message: operationalEvents.message,
        metadataJson: operationalEvents.metadataJson,
        createdAt: operationalEvents.createdAt,
      })
      .from(operationalEvents)
      .leftJoin(
        organizations,
        eq(organizations.id, operationalEvents.organizationId)
      )
      .where(where)
      .orderBy(desc(operationalEvents.createdAt))
      .limit(pagination.pageSize)
      .offset(offset),
    db.select({ count: count() }).from(operationalEvents).where(where),
  ]);

  return {
    items,
    totalItems: getFirstCount(totalRows),
  };
};
