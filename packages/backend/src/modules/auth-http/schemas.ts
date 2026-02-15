import { z } from "zod";

export const resendVerificationSchema = z
  .object({
    email: z.string().optional(),
    callbackURL: z.string().optional(),
  })
  .passthrough();

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
