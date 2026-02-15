import { z } from "zod";

export const listEmailsQuerySchema = z
  .object({
    address: z.string().optional(),
    addressId: z.string().optional(),
    limit: z.string().optional(),
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

export type ListEmailsQuery = z.infer<typeof listEmailsQuerySchema>;
export type EmailDetailQuery = z.infer<typeof emailDetailQuerySchema>;
