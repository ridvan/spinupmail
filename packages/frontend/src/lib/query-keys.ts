export const queryKeys = {
  addresses: ["app", "addresses"] as const,
  domains: ["app", "domains"] as const,
  apiKeys: ["app", "api-keys"] as const,
  emails: (addressId: string | null) => ["app", "emails", addressId] as const,
  emailDetail: (emailId: string | null) =>
    ["app", "email-detail", emailId] as const,
};
