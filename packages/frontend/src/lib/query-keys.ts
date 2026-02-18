export const queryKeys = {
  organizationStats: ["app", "organization-stats"] as const,
  emailActivity: (organizationId: string | null) =>
    ["app", "organizations", organizationId, "email-activity"] as const,
  emailSummary: (organizationId: string | null) =>
    ["app", "organizations", organizationId, "email-summary"] as const,
  recentAddressActivity: (
    organizationId: string | null,
    cursor: string | null,
    limit: number
  ) =>
    [
      "app",
      "organizations",
      organizationId,
      "recent-address-activity",
      limit,
      cursor,
    ] as const,
  addresses: (organizationId: string | null) =>
    ["app", "organizations", organizationId, "addresses"] as const,
  domains: (organizationId: string | null) =>
    ["app", "organizations", organizationId, "domains"] as const,
  apiKeys: ["app", "api-keys"] as const,
  emails: (organizationId: string | null, addressId: string | null) =>
    ["app", "organizations", organizationId, "emails", addressId] as const,
  emailDetail: (organizationId: string | null, emailId: string | null) =>
    ["app", "organizations", organizationId, "email-detail", emailId] as const,
};
