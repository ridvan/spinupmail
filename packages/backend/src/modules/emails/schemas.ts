import { z } from "zod";

export const EMAIL_SEARCH_MAX_LENGTH = 30;

export const listEmailsQuerySchema = z
  .object({
    address: z.string().optional(),
    addressId: z.string().optional(),
    search: z.string().trim().max(EMAIL_SEARCH_MAX_LENGTH).optional(),
    limit: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().optional(),
    order: z.string().optional(),
    after: z.string().optional(),
    before: z.string().optional(),
  })
  .passthrough();

export const emailDetailQuerySchema = z
  .object({
    raw: z.string().optional(),
  })
  .passthrough();

export const emailAttachmentQuerySchema = z
  .object({
    inline: z.string().optional(),
  })
  .passthrough();

export type ListEmailsQuery = z.infer<typeof listEmailsQuerySchema>;
export type EmailDetailQuery = z.infer<typeof emailDetailQuerySchema>;
export type EmailAttachmentQuery = z.infer<typeof emailAttachmentQuerySchema>;
