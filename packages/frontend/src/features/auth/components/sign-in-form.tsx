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
  AuthMutationError,
  useResendVerificationEmailMutation,
  useSignInMutation,
} from "@/features/auth/hooks/use-auth-mutations";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/features/auth/components/turnstile-widget";
import { toFieldErrors } from "@/features/form-utils/to-field-errors";

type SignInFormProps = {
  onSuccess?: () => Promise<void> | void;
  onTwoFactorRequired?: () => Promise<void> | void;
};

const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const SignInForm = ({
  onSuccess,
  onTwoFactorRequired,
}: SignInFormProps) => {
  const mutation = useSignInMutation();
  const turnstileRef = React.useRef<TurnstileWidgetHandle | null>(null);
  const resendMutation = useResendVerificationEmailMutation();
  const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [captchaError, setCaptchaError] = React.useState<string | null>(
    siteKey ? null : "Captcha is not configured."
  );
  const [resendFeedback, setResendFeedback] = React.useState<string | null>(
    null
  );
  const [resendError, setResendError] = React.useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = React.useState<number | null>(null);
  const [tick, setTick] = React.useState(() => Date.now());

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: signInSchema,
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

      let result: Awaited<ReturnType<typeof mutation.mutateAsync>>;
      try {
        result = await mutation.mutateAsync({
          ...value,
          captchaToken,
        });
      } finally {
        turnstileRef.current?.reset();
      }

      if (result.requiresTwoFactor) {
        await onTwoFactorRequired?.();
      } else {
        await onSuccess?.();
      }
    },
  });

  React.useEffect(() => {
    if (!cooldownUntil) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setTick(now);
      if (now >= cooldownUntil) {
        setCooldownUntil(null);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [cooldownUntil]);

  const cooldownSeconds = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - tick) / 1000))
    : 0;

  const isEmailNotVerifiedError =
    (mutation.error instanceof AuthMutationError &&
      mutation.error.code === "EMAIL_NOT_VERIFIED") ||
    /email not verified/i.test(mutation.error?.message ?? "");

  const handleResendVerification = async () => {
    const email = form.state.values.email.trim();
    if (!email) {
      setResendFeedback(null);
      setResendError("Enter your email first.");
      return;
    }

    setResendFeedback(null);
    setResendError(null);

    try {
      const result = await resendMutation.mutateAsync({ email });
      const until = Date.now() + result.cooldownSeconds * 1000;
      setCooldownUntil(until);
      setTick(Date.now());
      setResendFeedback("Verification email sent. Check your inbox.");
    } catch (error) {
      if (
        error instanceof AuthMutationError &&
        typeof error.retryAfterSeconds === "number" &&
        error.retryAfterSeconds > 0
      ) {
        const until = Date.now() + error.retryAfterSeconds * 1000;
        setCooldownUntil(until);
        setTick(Date.now());
        setResendError(
          `Please wait ${error.retryAfterSeconds}s before trying again.`
        );
        return;
      }

      setResendError(
        error instanceof Error
          ? error.message
          : "Unable to resend verification email."
      );
    }
  };

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
                  autoComplete="current-password"
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

      {isEmailNotVerifiedError ? (
        <div className="space-y-2">
          <Button
            className="w-full"
            disabled={resendMutation.isPending || cooldownSeconds > 0}
            onClick={() => {
              void handleResendVerification();
            }}
            type="button"
            variant="outline"
          >
            {resendMutation.isPending
              ? "Sending verification..."
              : cooldownSeconds > 0
                ? `Resend available in ${cooldownSeconds}s`
                : "Resend verification email"}
          </Button>
          {resendFeedback ? (
            <p className="text-sm text-muted-foreground">{resendFeedback}</p>
          ) : null}
          {resendError ? (
            <p className="text-sm text-destructive">{resendError}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <TurnstileWidget
          action="sign-in"
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
        {mutation.isPending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
};
