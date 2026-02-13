export const queryKeys = {
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
