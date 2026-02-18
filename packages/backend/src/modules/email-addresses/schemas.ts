import { z } from "zod";

export const createEmailAddressBodySchema = z
  .object({
    localPart: z.string().optional(),
    tag: z.string().optional(),
    ttlMinutes: z.number().optional(),
    meta: z.unknown().optional(),
    domain: z.string().optional(),
    allowedFromDomains: z.union([z.array(z.string()), z.string()]).optional(),
    acceptedRiskNotice: z.boolean().refine(value => value, {
      message: "acceptedRiskNotice must be true",
    }),
  })
  .passthrough();

export const listRecentAddressActivityQuerySchema = z
  .object({
    limit: z.string().optional(),
    cursor: z.string().optional(),
  })
  .passthrough();

export type CreateEmailAddressBody = z.infer<
  typeof createEmailAddressBodySchema
>;
export type ListRecentAddressActivityQuery = z.infer<
  typeof listRecentAddressActivityQuerySchema
>;
