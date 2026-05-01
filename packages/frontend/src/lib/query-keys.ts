import type {
  AdminOperationalEventSeverity,
  AdminOperationalEventType,
} from "@spinupmail/contracts";

export type AdminAnomaliesQueryKeyOptions = {
  page: number;
  pageSize: number;
  severity: AdminOperationalEventSeverity | "all";
  type: AdminOperationalEventType | "all";
  organizationId: string;
  from: string;
  to: string;
};

export const queryKeys = {
  adminOverview: ["app", "admin", "overview"] as const,
  adminActivity: (timezone: string) =>
    ["app", "admin", "activity", timezone] as const,
  adminOrganizations: (page: number, pageSize: number) =>
    ["app", "admin", "organizations", page, pageSize] as const,
  adminUserDetail: (userId: string | null) =>
    ["app", "admin", "users", "detail", userId] as const,
  adminOrganizationDetail: (organizationId: string | null) =>
    ["app", "admin", "organizations", "detail", organizationId] as const,
  adminApiKeys: (page: number, pageSize: number) =>
    ["app", "admin", "api-keys", page, pageSize] as const,
  adminAnomalies: (options: AdminAnomaliesQueryKeyOptions) =>
    [
      "app",
      "admin",
      "anomalies",
      options.page,
      options.pageSize,
      options.severity,
      options.type,
      options.organizationId,
      options.from,
      options.to,
    ] as const,
  adminUsers: (page: number, pageSize: number, search: string) =>
    ["app", "admin", "users", page, pageSize, search] as const,
  adminUserSessions: (userId: string | null) =>
    ["app", "admin", "users", userId, "sessions"] as const,
  organizationStats: ["app", "organization-stats"] as const,
  emailActivity: (organizationId: string | null, timezone: string) =>
    [
      "app",
      "organizations",
      organizationId,
      "email-activity",
      timezone,
    ] as const,
  emailSummary: (organizationId: string | null) =>
    ["app", "organizations", organizationId, "email-summary"] as const,
  recentAddressActivity: (
    organizationId: string | null,
    cursor: string | null,
    limit: number,
    search: string,
    sortBy: "recentActivity" | "createdAt",
    sortDirection: "asc" | "desc"
  ) =>
    [
      "app",
      "organizations",
      organizationId,
      "recent-address-activity",
      limit,
      cursor,
      search,
      sortBy,
      sortDirection,
    ] as const,
  addressesBase: (organizationId: string | null) =>
    ["app", "organizations", organizationId, "addresses"] as const,
  addressDetail: (organizationId: string | null, addressId: string | null) =>
    [
      "app",
      "organizations",
      organizationId,
      "addresses",
      "detail",
      addressId,
    ] as const,
  addressesAll: (organizationId: string | null) =>
    ["app", "organizations", organizationId, "addresses", "all"] as const,
  addresses: (
    organizationId: string | null,
    page: number,
    pageSize: number,
    search: string,
    sortBy: "createdAt" | "address" | "lastReceivedAt",
    sortDirection: "asc" | "desc"
  ) =>
    [
      "app",
      "organizations",
      organizationId,
      "addresses",
      page,
      pageSize,
      search,
      sortBy,
      sortDirection,
    ] as const,
  domains: (organizationId: string | null) =>
    ["app", "organizations", organizationId, "domains"] as const,
  integrations: (organizationId: string | null) =>
    ["app", "organizations", organizationId, "integrations"] as const,
  integrationDispatchesBase: (organizationId: string | null) =>
    [
      "app",
      "organizations",
      organizationId,
      "integrations",
      "dispatches",
    ] as const,
  integrationDispatches: (
    organizationId: string | null,
    integrationId: string | null,
    page: number,
    pageSize: number
  ) =>
    [
      "app",
      "organizations",
      organizationId,
      "integrations",
      "dispatches",
      integrationId,
      page,
      pageSize,
    ] as const,
  apiKeys: ["app", "api-keys"] as const,
  emailsBase: (organizationId: string | null, addressId: string | null) =>
    ["app", "organizations", organizationId, "emails", addressId] as const,
  emails: (
    organizationId: string | null,
    addressId: string | null,
    search: string,
    page: number,
    pageSize: number
  ) =>
    [
      "app",
      "organizations",
      organizationId,
      "emails",
      addressId,
      search,
      page,
      pageSize,
    ] as const,
  emailDetail: (organizationId: string | null, emailId: string | null) =>
    ["app", "organizations", organizationId, "email-detail", emailId] as const,
};
