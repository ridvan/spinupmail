import { z } from "zod";

export const resendVerificationSchema = z
  .object({
    email: z.string().optional(),
    callbackURL: z.string().optional(),
  })
  .passthrough();

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const requestPasswordSetupLinkSchema = z
  .object({
    callbackURL: z.string().optional(),
  })
  .passthrough();

export type RequestPasswordSetupLinkInput = z.infer<
  typeof requestPasswordSetupLinkSchema
>;
