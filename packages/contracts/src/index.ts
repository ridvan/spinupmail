import { z } from "zod";

export const domainConfigSchema = z.object({
  items: z.array(z.string().min(1)),
  default: z.string().nullable(),
});

export const organizationStatsItemSchema = z.object({
  organizationId: z.string().min(1),
  memberCount: z.number().int().nonnegative(),
  addressCount: z.number().int().nonnegative(),
  emailCount: z.number().int().nonnegative(),
});

export const emailListItemSchema = z.object({
  id: z.string().min(1),
  addressId: z.string().min(1),
  to: z.string().min(1),
  from: z.string().min(1),
  subject: z.string().nullable().optional(),
  messageId: z.string().nullable().optional(),
  rawSize: z.number().nullable().optional(),
  rawTruncated: z.boolean(),
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
