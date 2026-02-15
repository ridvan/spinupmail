import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldSeparator,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/features/auth/components/turnstile-widget";
import {
  useGoogleSignUpMutation,
  useSignUpMutation,
} from "@/features/auth/hooks/use-auth-mutations";
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
  const googleMutation = useGoogleSignUpMutation();
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
      className="space-y-5"
      noValidate
      onSubmit={event => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-6">
        <Field>
          <Button
            className="w-full border-white/15 bg-white/4 hover:bg-white/8"
            disabled={googleMutation.isPending}
            onClick={() => {
              void googleMutation.mutateAsync();
            }}
            type="button"
            variant="outline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
            {googleMutation.isPending
              ? "Redirecting..."
              : "Sign up with Google"}
          </Button>
          {googleMutation.error ? (
            <p className="pt-2 text-sm text-destructive">
              {googleMutation.error.message}
            </p>
          ) : null}
        </Field>
        <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card text-neutral-500">
          Or continue with
        </FieldSeparator>

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
                  className="border-white/15 bg-white/4 placeholder:text-neutral-500"
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
                  className="border-white/15 bg-white/4 placeholder:text-neutral-500"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={event => field.handleChange(event.target.value)}
                  placeholder="m@example.com"
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
                  className="border-white/15 bg-white/4 placeholder:text-neutral-500"
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
        className="w-full border-white bg-white text-neutral-900 hover:bg-neutral-200"
        disabled={
          mutation.isPending ||
          googleMutation.isPending ||
          !siteKey ||
          !captchaToken
        }
        type="submit"
      >
        {mutation.isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
};
