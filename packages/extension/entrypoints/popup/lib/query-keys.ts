export const queryKeys = {
  addressActivity: (organizationId: string | null) => [
    "extension",
    "address-activity",
    organizationId,
  ],
  bootstrap: (signature: string | null) => [
    "extension",
    "bootstrap",
    signature,
  ],
  detail: (organizationId: string | null, emailId: string | null) => [
    "extension",
    "email-detail",
    organizationId,
    emailId,
  ],
  domains: (organizationId: string | null) => [
    "extension",
    "domains",
    organizationId,
  ],
  emails: (organizationId: string | null, addressId: string | null) => [
    "extension",
    "emails",
    organizationId,
    addressId,
  ],
};
