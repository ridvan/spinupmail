import { z } from "zod";

export const createEmailAddressBodySchema = z
  .object({
    localPart: z.string().optional(),
    tag: z.string().max(30).optional(),
    ttlMinutes: z.number().optional(),
    meta: z.unknown().optional(),
    domain: z.string().optional(),
    allowedFromDomains: z.union([z.array(z.string()), z.string()]).optional(),
    acceptedRiskNotice: z.boolean().refine(value => value, {
      message: "acceptedRiskNotice must be true",
    }),
  })
  .passthrough();

export const listEmailAddressesQuerySchema = z
  .object({
    page: z.string().optional(),
    pageSize: z.string().optional(),
    sortBy: z.enum(["createdAt", "address", "lastReceivedAt"]).optional(),
    sortDirection: z.enum(["asc", "desc"]).optional(),
  })
  .passthrough();

export const updateEmailAddressBodySchema = z
  .object({
    localPart: z.string().optional(),
    tag: z.string().max(30).nullish(),
    ttlMinutes: z.number().nullable().optional(),
    meta: z.unknown().optional(),
    domain: z.string().optional(),
    allowedFromDomains: z.union([z.array(z.string()), z.string()]).optional(),
  })
  .passthrough();

export const listRecentAddressActivityQuerySchema = z
  .object({
    limit: z.string().optional(),
    cursor: z.string().optional(),
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
