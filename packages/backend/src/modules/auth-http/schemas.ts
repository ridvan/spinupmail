import { z } from "zod";

const isSafeCallbackURLShape = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const callbackURLSchema = z.string().trim().refine(isSafeCallbackURLShape);

export const resendVerificationSchema = z
  .object({
    email: z.string().optional(),
    callbackURL: callbackURLSchema.optional(),
  })
  .passthrough();

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const requestPasswordSetupLinkSchema = z
  .object({
    callbackURL: callbackURLSchema.optional(),
  })
  .passthrough();

export type RequestPasswordSetupLinkInput = z.infer<
  typeof requestPasswordSetupLinkSchema
>;
