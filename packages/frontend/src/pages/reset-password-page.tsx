import { useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { useResetPasswordMutation } from "@/features/auth/hooks/use-auth-mutations";
import { toFieldErrors } from "@/features/form-utils/to-field-errors";
import { cn } from "@/lib/utils";

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mutation = useResetPasswordMutation();

  const token = useMemo(() => {
    const value = searchParams.get("token");
    return value && value.trim().length > 0 ? value.trim() : null;
  }, [searchParams]);

  const tokenError = searchParams.get("error") === "INVALID_TOKEN";

  const form = useForm({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: resetPasswordSchema,
    },
    onSubmit: async ({ value }) => {
      if (!token) return;
      await mutation.mutateAsync({
        token,
        newPassword: value.newPassword,
      });
      await navigate("/login?passwordReset=success", { replace: true });
    },
  });

  const loginLink = "/login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.1448_0_0)] px-4 py-10">
      <AuthLayout
        subtitle="Choose a new password to finish resetting your account."
        footer={
          <>
            Remembered your password?{" "}
            <Link className="text-neutral-300 hover:text-white" to={loginLink}>
              Sign in
            </Link>
          </>
        }
      >
        {tokenError || !token ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">
              {tokenError
                ? "This reset link is invalid or expired."
                : "Reset token is missing. Request a new password reset link."}
            </p>
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              to={loginLink}
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            className="space-y-5"
            noValidate
            onSubmit={event => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <FieldGroup className="gap-6">
              <form.Field
                name="newPassword"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                      <Input
                        autoComplete="new-password"
                        aria-invalid={isInvalid}
                        className="border-white/15 bg-white/4 placeholder:text-neutral-500"
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={event =>
                          field.handleChange(event.target.value)
                        }
                        type="password"
                        value={field.state.value}
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

              <form.Field
                name="confirmPassword"
                children={field => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        Confirm new password
                      </FieldLabel>
                      <Input
                        autoComplete="new-password"
                        aria-invalid={isInvalid}
                        className="border-white/15 bg-white/4 placeholder:text-neutral-500"
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={event =>
                          field.handleChange(event.target.value)
                        }
                        type="password"
                        value={field.state.value}
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
            </FieldGroup>

            {mutation.error ? (
              <p className="text-sm text-destructive">
                {mutation.error.message}
              </p>
            ) : null}

            <Button
              className="w-full border-white bg-white text-neutral-900 hover:bg-neutral-200"
              disabled={mutation.isPending}
              type="submit"
            >
              {mutation.isPending ? "Updating password..." : "Update password"}
            </Button>
          </form>
        )}
      </AuthLayout>
    </div>
  );
};
