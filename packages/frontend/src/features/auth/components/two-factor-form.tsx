import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toFieldErrors } from "@/features/form-utils/to-field-errors";
import { authClient } from "@/lib/auth";

const OTP_LENGTH = 6;

type VerificationMethod = "totp" | "backup";

const verificationSchema = z.discriminatedUnion("verificationMethod", [
  z.object({
    verificationMethod: z.literal("totp"),
    otpCode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit code"),
    backupCode: z.string(),
    trustDevice: z.boolean(),
  }),
  z.object({
    verificationMethod: z.literal("backup"),
    otpCode: z.string(),
    backupCode: z.string().trim().min(1, "Backup code is required"),
    trustDevice: z.boolean(),
  }),
]);

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

type TwoFactorFormProps = {
  onSuccess?: () => Promise<void> | void;
};

export const TwoFactorForm = ({ onSuccess }: TwoFactorFormProps) => {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      verificationMethod: "totp" as VerificationMethod,
      otpCode: "",
      backupCode: "",
      trustDevice: true,
    },
    validators: {
      onSubmit: verificationSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      try {
        if (value.verificationMethod === "totp") {
          const result = await authClient.twoFactor.verifyTotp({
            code: value.otpCode,
            trustDevice: value.trustDevice,
          });

          if (result.error) {
            throw new Error(
              result.error.message || "Invalid verification code"
            );
          }
        } else {
          const result = await authClient.twoFactor.verifyBackupCode({
            code: value.backupCode.trim(),
            trustDevice: value.trustDevice,
          });

          if (result.error) {
            throw new Error(result.error.message || "Invalid backup code");
          }
        }

        const sessionResult = await authClient.getSession();
        if (sessionResult.error) {
          throw new Error(
            sessionResult.error.message || "Unable to load session"
          );
        }

        await onSuccess?.();
      } catch (error) {
        setSubmitError(
          getErrorMessage(error, "Unable to verify two-factor code")
        );
      }
    },
  });

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={event => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="verificationMethod"
        children={field => (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                setSubmitError(null);
                field.handleChange("totp");
              }}
              type="button"
              variant={field.state.value === "totp" ? "secondary" : "outline"}
            >
              Authenticator app
            </Button>
            <Button
              onClick={() => {
                setSubmitError(null);
                field.handleChange("backup");
              }}
              type="button"
              variant={field.state.value === "backup" ? "secondary" : "outline"}
            >
              Backup code
            </Button>
          </div>
        )}
      />

      <form.Subscribe
        selector={state => state.values.verificationMethod}
        children={verificationMethod =>
          verificationMethod === "totp" ? (
            <form.Field
              name="otpCode"
              children={field => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;

                return (
                  <Field data-invalid={isInvalid}>
                    <div className="flex justify-center">
                      <FieldLabel htmlFor={field.name}>6-digit code</FieldLabel>
                    </div>
                    <InputOTP
                      autoFocus
                      containerClassName="justify-center"
                      id={field.name}
                      maxLength={OTP_LENGTH}
                      pushPasswordManagerStrategy="none"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={value =>
                        field.handleChange(
                          value.replace(/\D/g, "").slice(0, OTP_LENGTH)
                        )
                      }
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                    {isInvalid ? (
                      <FieldError
                        errors={toFieldErrors(field.state.meta.errors)}
                      />
                    ) : null}
                  </Field>
                );
              }}
            />
          ) : (
            <form.Field
              name="backupCode"
              children={field => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Backup code</FieldLabel>
                    <Input
                      autoComplete="one-time-code"
                      aria-invalid={isInvalid}
                      className="mx-auto max-w-sm font-mono text-center"
                      id={field.name}
                      name={field.name}
                      placeholder="Enter one backup code"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={event => field.handleChange(event.target.value)}
                    />
                    {isInvalid ? (
                      <FieldError
                        errors={toFieldErrors(field.state.meta.errors)}
                      />
                    ) : null}
                  </Field>
                );
              }}
            />
          )
        }
      />

      <form.Field
        name="trustDevice"
        children={field => (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              checked={field.state.value}
              className="h-4 w-4 rounded border-border"
              onChange={event => field.handleChange(event.target.checked)}
              type="checkbox"
            />
            Trust this device for 30 days
          </label>
        )}
      />

      <Button
        className="w-full"
        disabled={form.state.isSubmitting}
        type="submit"
      >
        {form.state.isSubmitting ? "Verifying..." : "Verify code"}
      </Button>
      {submitError ? (
        <p className="text-sm text-destructive">{submitError}</p>
      ) : null}
    </form>
  );
};
