import { z } from "zod";

export const apiErrorSchema = z.object({
  error: z.string().min(1),
  details: z.string().min(1).optional(),
});

export const sortDirectionSchema = z.enum(["asc", "desc"]);
export const emailAddressSortBySchema = z.enum([
  "createdAt",
  "address",
  "lastReceivedAt",
]);
export const recentAddressActivitySortBySchema = z.enum([
  "recentActivity",
  "createdAt",
]);
export const maxReceivedEmailActionSchema = z.enum(["cleanAll", "rejectNew"]);
export const emailOrderSchema = sortDirectionSchema;

export const inboundRatePolicySchema = z
  .object({
    senderDomainSoftMax: z.number().int().positive().optional(),
    senderDomainSoftWindowSeconds: z.number().int().positive().optional(),
    senderDomainBlockMax: z.number().int().positive().optional(),
    senderDomainBlockWindowSeconds: z.number().int().positive().optional(),
    senderAddressBlockMax: z.number().int().positive().optional(),
    senderAddressBlockWindowSeconds: z.number().int().positive().optional(),
    inboxBlockMax: z.number().int().positive().optional(),
    inboxBlockWindowSeconds: z.number().int().positive().optional(),
    dedupeWindowSeconds: z.number().int().positive().optional(),
    initialBlockSeconds: z.number().int().positive().optional(),
    maxBlockSeconds: z.number().int().positive().optional(),
  })
  .partial();

export const domainConfigSchema = z.object({
  items: z.array(z.string().min(1)),
  default: z.string().nullable(),
  forcedLocalPartPrefix: z.string().nullable(),
  maxReceivedEmailsPerOrganization: z.number().int().positive(),
  maxReceivedEmailsPerAddress: z.number().int().positive(),
});

export const organizationStatsItemSchema = z.object({
  organizationId: z.string().min(1),
  memberCount: z.number().int().nonnegative(),
  addressCount: z.number().int().nonnegative(),
  emailCount: z.number().int().nonnegative(),
});

export const organizationStatsResponseSchema = z.object({
  items: z.array(organizationStatsItemSchema),
});

export const emailAddressSchema = z.object({
  id: z.string().min(1),
  address: z.string().min(1),
  localPart: z.string().min(1),
  domain: z.string().min(1),
  meta: z.unknown().optional(),
  emailCount: z.number().int().nonnegative(),
  allowedFromDomains: z.array(z.string().min(1)).optional(),
  blockedSenderDomains: z.array(z.string().min(1)).optional(),
  inboundRatePolicy: inboundRatePolicySchema.nullable().optional(),
  maxReceivedEmailCount: z.number().int().positive().nullable(),
  maxReceivedEmailAction: maxReceivedEmailActionSchema.nullable(),
  createdAt: z.string().nullable(),
  createdAtMs: z.number().nullable(),
  expiresAt: z.string().nullable(),
  expiresAtMs: z.number().nullable(),
  lastReceivedAt: z.string().nullable(),
  lastReceivedAtMs: z.number().nullable(),
});

export const createEmailAddressResponseSchema = emailAddressSchema;

export const emailAddressListResponseSchema = z.object({
  items: z.array(emailAddressSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  addressLimit: z.number().int().positive(),
  totalPages: z.number().int().positive(),
  sortBy: emailAddressSortBySchema,
  sortDirection: sortDirectionSchema,
});

export const listEmailAddressesParamsSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  search: z.string().optional(),
  sortBy: emailAddressSortBySchema.optional(),
  sortDirection: sortDirectionSchema.optional(),
});

export const listRecentAddressActivityParamsSchema = z.object({
  limit: z.number().int().positive().optional(),
  cursor: z.string().min(1).optional(),
  search: z.string().optional(),
  sortBy: recentAddressActivitySortBySchema.optional(),
  sortDirection: sortDirectionSchema.optional(),
});

export const recentAddressActivityResponseSchema = z.object({
  items: z.array(emailAddressSchema),
  nextCursor: z.string().nullable(),
  totalItems: z.number().int().nonnegative(),
});

export const createEmailAddressRequestSchema = z.object({
  localPart: z.string().min(1),
  ttlMinutes: z.number().int().positive().optional(),
  meta: z.unknown().optional(),
  domain: z.string().min(1).optional(),
  allowedFromDomains: z.array(z.string().min(1)).optional(),
  blockedSenderDomains: z.array(z.string().min(1)).optional(),
  inboundRatePolicy: inboundRatePolicySchema.optional(),
  maxReceivedEmailCount: z.number().int().positive().optional(),
  maxReceivedEmailAction: maxReceivedEmailActionSchema.optional(),
  acceptedRiskNotice: z.literal(true),
});

export const updateEmailAddressRequestSchema = z.object({
  localPart: z.string().min(1).optional(),
  ttlMinutes: z.number().int().positive().nullable().optional(),
  meta: z.unknown().optional(),
  domain: z.string().min(1).optional(),
  allowedFromDomains: z.array(z.string().min(1)).optional(),
  blockedSenderDomains: z.array(z.string().min(1)).nullable().optional(),
  inboundRatePolicy: inboundRatePolicySchema.nullable().optional(),
  maxReceivedEmailCount: z.number().int().positive().nullable().optional(),
  maxReceivedEmailAction: maxReceivedEmailActionSchema.optional(),
});

export const deleteEmailAddressResponseSchema = z.object({
  id: z.string().min(1),
  address: z.string().min(1),
  deleted: z.literal(true),
});

export const emailAttachmentSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  disposition: z.string().nullable(),
  contentId: z.string().nullable(),
  inlinePath: z.string().min(1),
  downloadPath: z.string().min(1),
});

export const emailListItemSchema = z.object({
  id: z.string().min(1),
  addressId: z.string().min(1),
  to: z.string().min(1),
  from: z.string().min(1),
  sender: z.string().nullable().optional(),
  senderLabel: z.string().min(1),
  subject: z.string().nullable().optional(),
  messageId: z.string().nullable().optional(),
  rawSize: z.number().nullable().optional(),
  rawTruncated: z.boolean(),
  isSample: z.boolean(),
  hasHtml: z.boolean(),
  hasText: z.boolean(),
  attachmentCount: z.number().int().nonnegative(),
  receivedAt: z.string().nullable(),
  receivedAtMs: z.number().nullable(),
});

export const emailListResponseSchema = z.object({
  address: z.string().min(1),
  addressId: z.string().min(1),
  items: z.array(emailListItemSchema),
});

export const listEmailsParamsSchema = z.object({
  address: z.string().min(1).optional(),
  addressId: z.string().min(1).optional(),
  search: z.string().max(30).optional(),
  limit: z.number().int().positive().optional(),
  order: emailOrderSchema.optional(),
  after: z.union([z.string(), z.number()]).optional(),
  before: z.union([z.string(), z.number()]).optional(),
});

export const emailDetailSchema = z.object({
  id: z.string().min(1),
  addressId: z.string().min(1),
  address: z.string().min(1).optional(),
  to: z.string().min(1),
  from: z.string().min(1),
  sender: z.string().nullable().optional(),
  senderLabel: z.string().min(1),
  subject: z.string().nullable().optional(),
  messageId: z.string().nullable().optional(),
  headers: z.unknown(),
  html: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  raw: z.string().nullable().optional(),
  rawSize: z.number().nullable().optional(),
  rawTruncated: z.boolean(),
  isSample: z.boolean(),
  rawDownloadPath: z.string().optional(),
  attachments: z.array(emailAttachmentSchema),
  receivedAt: z.string().nullable(),
  receivedAtMs: z.number().nullable(),
});

export const deleteEmailResponseSchema = z.object({
  id: z.string().min(1),
  deleted: z.literal(true),
});

export const emailActivityDaySchema = z.object({
  date: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export const emailActivityResponseSchema = z.object({
  timezone: z.string().min(1),
  daily: z.array(emailActivityDaySchema),
});

export const emailSummaryDomainSchema = z.object({
  domain: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export const busiestInboxSchema = z.object({
  addressId: z.string().min(1),
  address: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export const dormantInboxSchema = z.object({
  addressId: z.string().min(1),
  address: z.string().min(1),
  createdAt: z.string().nullable(),
});

export const emailSummaryResponseSchema = z.object({
  totalEmailCount: z.number().int().nonnegative(),
  attachmentCount: z.number().int().nonnegative(),
  attachmentSizeTotal: z.number().int().nonnegative(),
  attachmentSizeLimit: z.number().int().nonnegative(),
  topDomains: z.array(emailSummaryDomainSchema),
  busiestInboxes: z.array(busiestInboxSchema),
  dormantInboxes: z.array(dormantInboxSchema),
});

export const organizationPickerItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  logo: z.string().nullable().optional(),
});

export const extensionBootstrapUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  emailVerified: z.boolean(),
});

export const extensionInvitationSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  status: z.string().min(1),
  organizationName: z.string().min(1).optional(),
  inviterEmail: z.string().email().optional(),
});

export const extensionBootstrapResponseSchema = z.object({
  user: extensionBootstrapUserSchema,
  organizations: z.array(organizationPickerItemSchema),
  defaultOrganizationId: z.string().min(1).nullable(),
  pendingInvitations: z.array(extensionInvitationSchema),
});

export const extensionAuthExchangeRequestSchema = z.object({
  code: z.string().min(1),
});

export const extensionAuthExchangeResponseSchema = z.object({
  apiKey: z.string().min(1),
  bootstrap: extensionBootstrapResponseSchema,
});

export const extensionAcceptInvitationRequestSchema = z.object({
  invitationId: z.string().min(1),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type SortDirection = z.infer<typeof sortDirectionSchema>;
export type EmailAddressSortBy = z.infer<typeof emailAddressSortBySchema>;
export type RecentAddressActivitySortBy = z.infer<
  typeof recentAddressActivitySortBySchema
>;
export type MaxReceivedEmailAction = z.infer<
  typeof maxReceivedEmailActionSchema
>;
export type InboundRatePolicy = z.infer<typeof inboundRatePolicySchema>;
export type DomainConfig = z.infer<typeof domainConfigSchema>;
export type OrganizationStatsItem = z.infer<typeof organizationStatsItemSchema>;
export type OrganizationStatsResponse = z.infer<
  typeof organizationStatsResponseSchema
>;
export type EmailAddress = z.infer<typeof emailAddressSchema>;
export type EmailAddressListResponse = z.infer<
  typeof emailAddressListResponseSchema
>;
export type ListEmailAddressesParams = z.infer<
  typeof listEmailAddressesParamsSchema
>;
export type ListRecentAddressActivityParams = z.infer<
  typeof listRecentAddressActivityParamsSchema
>;
export type RecentAddressActivityResponse = z.infer<
  typeof recentAddressActivityResponseSchema
>;
export type CreateEmailAddressRequest = z.infer<
  typeof createEmailAddressRequestSchema
>;
export type CreateEmailAddressResponse = z.infer<
  typeof createEmailAddressResponseSchema
>;
export type UpdateEmailAddressRequest = z.infer<
  typeof updateEmailAddressRequestSchema
>;
export type DeleteEmailAddressResponse = z.infer<
  typeof deleteEmailAddressResponseSchema
>;
export type EmailAttachment = z.infer<typeof emailAttachmentSchema>;
export type EmailListItem = z.infer<typeof emailListItemSchema>;
export type EmailListResponse = z.infer<typeof emailListResponseSchema>;
export type ListEmailsParams = z.infer<typeof listEmailsParamsSchema>;
export type EmailDetail = z.infer<typeof emailDetailSchema>;
export type DeleteEmailResponse = z.infer<typeof deleteEmailResponseSchema>;
export type EmailActivityDay = z.infer<typeof emailActivityDaySchema>;
export type EmailActivityResponse = z.infer<typeof emailActivityResponseSchema>;
export type EmailSummaryDomain = z.infer<typeof emailSummaryDomainSchema>;
export type BusiestInbox = z.infer<typeof busiestInboxSchema>;
export type DormantInbox = z.infer<typeof dormantInboxSchema>;
export type EmailSummaryResponse = z.infer<typeof emailSummaryResponseSchema>;
export type OrganizationPickerItem = z.infer<
  typeof organizationPickerItemSchema
>;
export type ExtensionBootstrapUser = z.infer<
  typeof extensionBootstrapUserSchema
>;
export type ExtensionInvitation = z.infer<typeof extensionInvitationSchema>;
export type ExtensionBootstrapResponse = z.infer<
  typeof extensionBootstrapResponseSchema
>;
export type ExtensionAuthExchangeRequest = z.infer<
  typeof extensionAuthExchangeRequestSchema
>;
export type ExtensionAuthExchangeResponse = z.infer<
  typeof extensionAuthExchangeResponseSchema
>;
export type ExtensionAcceptInvitationRequest = z.infer<
  typeof extensionAcceptInvitationRequestSchema
>;
