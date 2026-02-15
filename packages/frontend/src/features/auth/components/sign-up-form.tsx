import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/features/auth/components/turnstile-widget";
import { useSignUpMutation } from "@/features/auth/hooks/use-auth-mutations";
import { toFieldErrors } from "@/features/form-utils/to-field-errors";

type SignUpFormProps = {
  onSuccess?: () => Promise<void> | void;
};

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const SignUpForm = ({ onSuccess }: SignUpFormProps) => {
  const mutation = useSignUpMutation();
  const turnstileRef = React.useRef<TurnstileWidgetHandle | null>(null);
  const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [captchaError, setCaptchaError] = React.useState<string | null>(
    siteKey ? null : "Captcha is not configured."
  );

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
    validators: {
      onSubmit: signUpSchema,
    },
    onSubmit: async ({ value }) => {
      if (!siteKey) {
        setCaptchaError("Captcha is not configured.");
        return;
      }

      if (!captchaToken) {
        setCaptchaError("Complete the captcha challenge.");
        return;
      }

      try {
        await mutation.mutateAsync({
          ...value,
          captchaToken,
        });
      } finally {
        turnstileRef.current?.reset();
      }
      await onSuccess?.();
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
      <FieldGroup>
        <form.Field
          name="name"
          children={field => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  autoComplete="name"
                  aria-invalid={isInvalid}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={event => field.handleChange(event.target.value)}
                  placeholder="Ada Lovelace"
                  value={field.state.value}
                />
                {isInvalid ? (
                  <FieldError errors={toFieldErrors(field.state.meta.errors)} />
                ) : null}
              </Field>
            );
          }}
        />

        <form.Field
          name="email"
          children={field => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  autoComplete="email"
                  aria-invalid={isInvalid}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={event => field.handleChange(event.target.value)}
                  placeholder="you@company.com"
                  type="email"
                  value={field.state.value}
                />
                {isInvalid ? (
                  <FieldError errors={toFieldErrors(field.state.meta.errors)} />
                ) : null}
              </Field>
            );
          }}
        />

        <form.Field
          name="password"
          children={field => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                <Input
                  autoComplete="new-password"
                  aria-invalid={isInvalid}
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={event => field.handleChange(event.target.value)}
                  type="password"
                  value={field.state.value}
                />
                {isInvalid ? (
                  <FieldError errors={toFieldErrors(field.state.meta.errors)} />
                ) : null}
              </Field>
            );
          }}
        />
      </FieldGroup>

      {mutation.error ? (
        <p className="text-sm text-destructive">{mutation.error.message}</p>
      ) : null}

      <div className="space-y-2">
        <TurnstileWidget
          action="sign-up"
          onTokenChange={token => {
            setCaptchaToken(token);
            if (token) {
              setCaptchaError(null);
            }
          }}
          ref={turnstileRef}
          siteKey={siteKey}
        />
        {captchaError ? (
          <p className="text-sm text-destructive">{captchaError}</p>
        ) : null}
      </div>

      <Button
        className="w-full"
        disabled={mutation.isPending || !siteKey || !captchaToken}
        type="submit"
      >
        {mutation.isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
};
