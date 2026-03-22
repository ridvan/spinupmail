import { z } from "zod";

export const ADDRESS_LOCAL_PART_MAX_LENGTH = 30;
export const ADDRESS_TTL_MAX_MINUTES = 43_200;
export const ADDRESS_ALLOWED_FROM_DOMAINS_MAX_ITEMS = 10;
export const ADDRESS_ALLOWED_FROM_DOMAIN_MAX_LENGTH = 50;
export const ADDRESS_BLOCKED_SENDER_DOMAINS_MAX_ITEMS = 50;
export const ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX = 100_000;
export const ADDRESS_MAX_RECEIVED_EMAIL_ACTIONS = [
  "cleanAll",
  "rejectNew",
] as const;
const ADDRESS_LOCAL_PART_REGEX = /^[a-z0-9._+-]+$/i;
const DOMAIN_HOSTNAME_REGEX =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const allowedFromDomainsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(ADDRESS_ALLOWED_FROM_DOMAIN_MAX_LENGTH)
      .regex(DOMAIN_HOSTNAME_REGEX, "Invalid domain hostname")
  )
  .max(ADDRESS_ALLOWED_FROM_DOMAINS_MAX_ITEMS);

const blockedSenderDomainsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(ADDRESS_ALLOWED_FROM_DOMAIN_MAX_LENGTH)
      .regex(DOMAIN_HOSTNAME_REGEX, "Invalid domain hostname")
  )
  .max(ADDRESS_BLOCKED_SENDER_DOMAINS_MAX_ITEMS);

const inboundRatePolicySchema = z
  .object({
    senderDomainSoftMax: z.number().int().positive().max(864_000).optional(),
    senderDomainSoftWindowSeconds: z
      .number()
      .int()
      .positive()
      .max(864_000)
      .optional(),
    senderDomainBlockMax: z.number().int().positive().max(864_000).optional(),
    senderDomainBlockWindowSeconds: z
      .number()
      .int()
      .positive()
      .max(864_000)
      .optional(),
    senderAddressBlockMax: z.number().int().positive().max(864_000).optional(),
    senderAddressBlockWindowSeconds: z
      .number()
      .int()
      .positive()
      .max(864_000)
      .optional(),
    inboxBlockMax: z.number().int().positive().max(864_000).optional(),
    inboxBlockWindowSeconds: z
      .number()
      .int()
      .positive()
      .max(864_000)
      .optional(),
    dedupeWindowSeconds: z.number().int().positive().max(864_000).optional(),
    initialBlockSeconds: z.number().int().positive().max(864_000).optional(),
    maxBlockSeconds: z.number().int().positive().max(864_000).optional(),
  })
  .partial();

export const createEmailAddressBodySchema = z
  .object({
    localPart: z
      .string()
      .trim()
      .min(1)
      .max(ADDRESS_LOCAL_PART_MAX_LENGTH)
      .regex(ADDRESS_LOCAL_PART_REGEX),
    ttlMinutes: z
      .number()
      .int()
      .positive()
      .max(ADDRESS_TTL_MAX_MINUTES)
      .optional(),
    meta: z.unknown().optional(),
    domain: z.string().optional(),
    allowedFromDomains: z
      .union([allowedFromDomainsSchema, z.string()])
      .optional(),
    blockedSenderDomains: z
      .union([blockedSenderDomainsSchema, z.string()])
      .optional(),
    inboundRatePolicy: inboundRatePolicySchema.optional(),
    maxReceivedEmailCount: z
      .number()
      .int()
      .positive()
      .max(ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX)
      .optional(),
    maxReceivedEmailAction: z
      .enum(ADDRESS_MAX_RECEIVED_EMAIL_ACTIONS)
      .optional(),
    acceptedRiskNotice: z.boolean().refine(value => value, {
      message: "acceptedRiskNotice must be true",
    }),
  })
  .passthrough();

export const listEmailAddressesQuerySchema = z
  .object({
    page: z.string().optional(),
    pageSize: z.string().optional(),
    search: z.string().optional(),
    sortBy: z.enum(["createdAt", "address", "lastReceivedAt"]).optional(),
    sortDirection: z.enum(["asc", "desc"]).optional(),
  })
  .passthrough();

export const updateEmailAddressBodySchema = z
  .object({
    localPart: z
      .string()
      .trim()
      .min(1)
      .max(ADDRESS_LOCAL_PART_MAX_LENGTH)
      .regex(ADDRESS_LOCAL_PART_REGEX)
      .optional(),
    ttlMinutes: z
      .number()
      .int()
      .positive()
      .max(ADDRESS_TTL_MAX_MINUTES)
      .nullable()
      .optional(),
    meta: z.unknown().optional(),
    domain: z.string().optional(),
    allowedFromDomains: z
      .union([allowedFromDomainsSchema, z.string()])
      .optional(),
    blockedSenderDomains: z
      .union([blockedSenderDomainsSchema, z.string(), z.null()])
      .optional(),
    inboundRatePolicy: inboundRatePolicySchema.nullable().optional(),
    maxReceivedEmailCount: z
      .number()
      .int()
      .positive()
      .max(ADDRESS_MAX_RECEIVED_EMAIL_COUNT_MAX)
      .nullable()
      .optional(),
    maxReceivedEmailAction: z
      .enum(ADDRESS_MAX_RECEIVED_EMAIL_ACTIONS)
      .optional(),
  })
  .passthrough();

export const listRecentAddressActivityQuerySchema = z
  .object({
    limit: z.string().optional(),
    cursor: z.string().optional(),
    search: z.string().optional(),
    sortBy: z.enum(["recentActivity", "createdAt"]).optional(),
    sortDirection: z.enum(["asc", "desc"]).optional(),
  })
  .passthrough();

export type ListEmailAddressesQuery = z.infer<
  typeof listEmailAddressesQuerySchema
>;
export type CreateEmailAddressBody = z.infer<
  typeof createEmailAddressBodySchema
>;
export type UpdateEmailAddressBody = z.infer<
  typeof updateEmailAddressBodySchema
>;
export type ListRecentAddressActivityQuery = z.infer<
  typeof listRecentAddressActivityQuerySchema
>;
