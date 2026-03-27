import { z } from "zod";

export const createOrganizationBodySchema = z.object({
  name: z.string().trim().min(2).max(64),
});

export type CreateOrganizationBody = z.infer<
  typeof createOrganizationBodySchema
>;
