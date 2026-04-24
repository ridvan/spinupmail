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
export const maxReceivedEmailActionSchema = z.enum(["cleanAll", "dropNew"]);
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

export const integrationProviderSchema = z.enum(["telegram"]);
export const integrationStatusSchema = z.enum(["active", "archived"]);
export const integrationEventTypeSchema = z.enum(["email.received"]);
export const integrationDispatchStatusSchema = z.enum([
  "pending",
  "processing",
  "retry_scheduled",
  "sent",
  "failed_permanent",
  "failed_dlq",
]);

export const INTEGRATION_MAX_PER_ORGANIZATION = 3;

export const TELEGRAM_BOT_NAME_MAX_LENGTH = 30;
export const TELEGRAM_BOT_TOKEN_MAX_LENGTH = 256;
export const TELEGRAM_CHAT_ID_MAX_LENGTH = 128;

export const TELEGRAM_BOT_TOKEN_REGEX = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;
export const TELEGRAM_CHAT_ID_NUMERIC_REGEX = /^-?\d{5,20}$/;
export const TELEGRAM_CHAT_USERNAME_REGEX = /^@[A-Za-z][A-Za-z0-9_]{4,31}$/;

export const telegramIntegrationPublicConfigSchema = z.object({
  telegramBotId: z.string().min(1),
  botUsername: z.string().min(1),
  chatId: z.string().min(1),
  chatLabel: z.string().nullable(),
});

export const telegramIntegrationSecretConfigSchema = z.object({
  botToken: z
    .string()
    .trim()
    .min(1, "Bot token is required")
    .max(
      TELEGRAM_BOT_TOKEN_MAX_LENGTH,
      `Bot token must be at most ${TELEGRAM_BOT_TOKEN_MAX_LENGTH} characters`
    )
    .regex(
      TELEGRAM_BOT_TOKEN_REGEX,
      "Bot token must look like 123456:ABC... (digits before ':' and at least 30 token characters)"
    ),
  chatId: z
    .string()
    .trim()
    .min(1, "Chat ID is required")
    .max(
      TELEGRAM_CHAT_ID_MAX_LENGTH,
      `Chat ID must be at most ${TELEGRAM_CHAT_ID_MAX_LENGTH} characters`
    )
    .refine(
      value =>
        TELEGRAM_CHAT_ID_NUMERIC_REGEX.test(value) ||
        TELEGRAM_CHAT_USERNAME_REGEX.test(value),
      "Chat ID must be a numeric ID like -1001234567890 or a username like @my_channel"
    ),
});

export const telegramIntegrationValidationSummarySchema = z.object({
  name: z.string().min(1),
  publicConfig: telegramIntegrationPublicConfigSchema,
});

const organizationIntegrationCommonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: integrationStatusSchema,
  supportedEventTypes: z.array(integrationEventTypeSchema),
  mailboxCount: z.number().int().nonnegative(),
  lastValidatedAt: z.string().nullable(),
  lastValidatedAtMs: z.number().nullable(),
  createdAt: z.string().nullable(),
  createdAtMs: z.number().nullable(),
  updatedAt: z.string().nullable(),
  updatedAtMs: z.number().nullable(),
});

export const organizationIntegrationSummarySchema = z.discriminatedUnion(
  "provider",
  [
    organizationIntegrationCommonSchema.extend({
      provider: z.literal("telegram"),
      publicConfig: telegramIntegrationPublicConfigSchema,
    }),
  ]
);

export const organizationIntegrationSchema = z.discriminatedUnion("provider", [
  organizationIntegrationCommonSchema.extend({
    provider: z.literal("telegram"),
    publicConfig: telegramIntegrationPublicConfigSchema,
    createdByUserId: z.string().min(1),
    activeSecretVersion: z.number().int().positive(),
  }),
]);

export const integrationSubscriptionSchema = z.object({
  integrationId: z.string().min(1),
  eventType: integrationEventTypeSchema,
});

export const addressIntegrationSchema = z.object({
  id: z.string().min(1),
  provider: integrationProviderSchema,
  name: z.string().min(1),
  eventType: integrationEventTypeSchema,
});

export const validateIntegrationConnectionRequestSchema = z.discriminatedUnion(
  "provider",
  [
    z.object({
      provider: z.literal("telegram"),
      name: z
        .string()
        .trim()
        .min(1, "Integration name is required")
        .max(
          TELEGRAM_BOT_NAME_MAX_LENGTH,
          `Integration name must be at most ${TELEGRAM_BOT_NAME_MAX_LENGTH} characters`
        ),
      config: telegramIntegrationSecretConfigSchema,
    }),
  ]
);

export const validateIntegrationConnectionResponseSchema = z.discriminatedUnion(
  "provider",
  [
    z.object({
      provider: z.literal("telegram"),
      name: z.string().min(1),
      publicConfig: telegramIntegrationPublicConfigSchema,
      validationSummary: telegramIntegrationValidationSummarySchema,
    }),
  ]
);

export const createIntegrationRequestSchema =
  validateIntegrationConnectionRequestSchema;

export const listIntegrationsResponseSchema = z.object({
  items: z.array(organizationIntegrationSummarySchema),
});

export const deleteIntegrationResponseSchema = z.object({
  id: z.string().min(1),
  deleted: z.literal(true),
  clearedMailboxCount: z.number().int().nonnegative(),
  deletedDispatchCount: z.number().int().nonnegative(),
});

export const integrationDispatchSchema = z.object({
  id: z.string().min(1),
  integrationId: z.string().min(1),
  provider: integrationProviderSchema,
  eventType: integrationEventTypeSchema,
  status: integrationDispatchStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  createdAt: z.string().nullable(),
  createdAtMs: z.number().nullable(),
  nextAttemptAt: z.string().nullable(),
  nextAttemptAtMs: z.number().nullable(),
  deliveredAt: z.string().nullable(),
  deliveredAtMs: z.number().nullable(),
  lastError: z.string().nullable(),
  lastErrorCode: z.string().nullable(),
  lastErrorStatus: z.number().nullable(),
});

export const listIntegrationDispatchesResponseSchema = z.object({
  items: z.array(integrationDispatchSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const listIntegrationDispatchesParamsSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const replayIntegrationDispatchResponseSchema = z.object({
  id: z.string().min(1),
  status: integrationDispatchStatusSchema,
  replayed: z.literal(true),
});

export const emailAddressSchema = z.object({
  id: z.string().min(1),
  address: z.string().min(1),
  localPart: z.string().min(1),
  domain: z.string().min(1),
  meta: z.unknown().optional(),
  integrations: z.array(addressIntegrationSchema),
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
  integrationSubscriptions: z.array(integrationSubscriptionSchema).optional(),
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
  integrationSubscriptions: z.array(integrationSubscriptionSchema).optional(),
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
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;
export type IntegrationEventType = z.infer<typeof integrationEventTypeSchema>;
export type IntegrationDispatchStatus = z.infer<
  typeof integrationDispatchStatusSchema
>;
export type TelegramIntegrationPublicConfig = z.infer<
  typeof telegramIntegrationPublicConfigSchema
>;
export type TelegramIntegrationSecretConfig = z.infer<
  typeof telegramIntegrationSecretConfigSchema
>;
export type TelegramIntegrationValidationSummary = z.infer<
  typeof telegramIntegrationValidationSummarySchema
>;
export type OrganizationIntegrationSummary = z.infer<
  typeof organizationIntegrationSummarySchema
>;
export type OrganizationIntegration = z.infer<
  typeof organizationIntegrationSchema
>;
export type IntegrationSubscription = z.infer<
  typeof integrationSubscriptionSchema
>;
export type AddressIntegration = z.infer<typeof addressIntegrationSchema>;
export type ValidateIntegrationConnectionRequest = z.infer<
  typeof validateIntegrationConnectionRequestSchema
>;
export type ValidateIntegrationConnectionResponse = z.infer<
  typeof validateIntegrationConnectionResponseSchema
>;
export type CreateIntegrationRequest = z.infer<
  typeof createIntegrationRequestSchema
>;
export type ListIntegrationsResponse = z.infer<
  typeof listIntegrationsResponseSchema
>;
export type DeleteIntegrationResponse = z.infer<
  typeof deleteIntegrationResponseSchema
>;
export type IntegrationDispatch = z.infer<typeof integrationDispatchSchema>;
export type ListIntegrationDispatchesResponse = z.infer<
  typeof listIntegrationDispatchesResponseSchema
>;
export type ListIntegrationDispatchesParams = z.infer<
  typeof listIntegrationDispatchesParamsSchema
>;
export type ReplayIntegrationDispatchResponse = z.infer<
  typeof replayIntegrationDispatchResponseSchema
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
