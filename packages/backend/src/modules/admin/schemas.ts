import { z } from "zod";
import {
  adminOperationalEventSeveritySchema,
  adminOperationalEventTypeSchema,
} from "@spinupmail/contracts";

export const adminActivityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).optional(),
  timezone: z.string().min(1).max(128).optional(),
});

export const adminPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const adminAnomaliesQuerySchema = adminPaginationQuerySchema.extend({
  severity: adminOperationalEventSeveritySchema.optional(),
  type: adminOperationalEventTypeSchema.optional(),
  organizationId: z.string().min(1).optional(),
  from: z.iso.datetime({ local: true }).optional(),
  to: z.iso.datetime({ local: true }).optional(),
});
