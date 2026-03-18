export const queryKeys = {
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
  apiKeys: ["app", "api-keys"] as const,
  emailsBase: (organizationId: string | null, addressId: string | null) =>
    ["app", "organizations", organizationId, "emails", addressId] as const,
  emails: (
    organizationId: string | null,
    addressId: string | null,
    search: string
  ) =>
    [
      "app",
      "organizations",
      organizationId,
      "emails",
      addressId,
      search,
    ] as const,
  emailDetail: (organizationId: string | null, emailId: string | null) =>
    ["app", "organizations", organizationId, "email-detail", emailId] as const,
};
