import { z } from "zod";

export const createOrganizationBodySchema = z.object({
  name: z.string().trim().min(2).max(64),
});

export const deleteOrganizationBodySchema = z.object({
  confirmationName: z.string().min(1),
});

export type CreateOrganizationBody = z.infer<
  typeof createOrganizationBodySchema
>;

export type DeleteOrganizationBody = z.infer<
  typeof deleteOrganizationBodySchema
>;
