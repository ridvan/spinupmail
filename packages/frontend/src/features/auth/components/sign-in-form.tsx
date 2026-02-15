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
  ArrowLeftIcon,
  type ArrowLeftIconHandle,
} from "@/components/ui/arrow-left";
import {
  AuthMutationError,
  useGoogleSignInMutation,
  useRequestPasswordResetMutation,
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
  showVerificationNotice?: boolean;
  showPasswordResetNotice?: boolean;
  isForgotPasswordMode: boolean;
  onForgotPasswordModeChange: (isForgotPasswordMode: boolean) => void;
};

const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const SignInForm = ({
  onSuccess,
  onTwoFactorRequired,
  showVerificationNotice = false,
  showPasswordResetNotice = false,
  isForgotPasswordMode,
  onForgotPasswordModeChange,
}: SignInFormProps) => {
  const mutation = useSignInMutation();
  const googleMutation = useGoogleSignInMutation();
  const forgotPasswordMutation = useRequestPasswordResetMutation();
  const backToSignInIconRef = React.useRef<ArrowLeftIconHandle | null>(null);
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
  const [forgotPasswordFeedback, setForgotPasswordFeedback] = React.useState<
    string | null
  >(null);
  const [forgotPasswordError, setForgotPasswordError] = React.useState<
    string | null
  >(null);

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

  const enterForgotPasswordMode = () => {
    onForgotPasswordModeChange(true);
    setForgotPasswordFeedback(null);
    setForgotPasswordError(null);
    mutation.reset();
  };

  const leaveForgotPasswordMode = () => {
    onForgotPasswordModeChange(false);
    setForgotPasswordFeedback(null);
    setForgotPasswordError(null);
    forgotPasswordMutation.reset();
  };

  const handleForgotPasswordSubmit = async () => {
    if (!siteKey) {
      setCaptchaError("Captcha is not configured.");
      return;
    }

    if (!captchaToken) {
      setCaptchaError("Complete the captcha challenge.");
      return;
    }

    const parsed = forgotPasswordSchema.safeParse({
      email: form.state.values.email.trim(),
    });

    if (!parsed.success) {
      setForgotPasswordFeedback(null);
      setForgotPasswordError(
        parsed.error.issues[0]?.message ?? "Enter a valid email"
      );
      return;
    }

    setForgotPasswordFeedback(null);
    setForgotPasswordError(null);

    try {
      await forgotPasswordMutation.mutateAsync({
        email: parsed.data.email,
        captchaToken,
      });
      setForgotPasswordFeedback(
        "If an account exists for that email, a reset link has been sent."
      );
    } catch (error) {
      setForgotPasswordError(
        error instanceof Error ? error.message : "Unable to send reset link."
      );
    } finally {
      turnstileRef.current?.reset();
    }
  };

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
      className="space-y-5"
      noValidate
      onSubmit={event => {
        event.preventDefault();
        event.stopPropagation();
        if (isForgotPasswordMode) {
          void handleForgotPasswordSubmit();
          return;
        }

        void form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-6">
        {!isForgotPasswordMode ? (
          <>
            <Field>
              <Button
                className="w-full border-white/15 bg-white/4 hover:bg-white/8 cursor-pointer"
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
                  : "Sign in with Google"}
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
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Enter your account email and we&apos;ll send you a password reset
            link.
          </p>
        )}

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

        {!isForgotPasswordMode ? (
          <form.Field
            name="password"
            children={field => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;

              return (
                <Field data-invalid={isInvalid}>
                  <div className="flex items-center">
                    <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                    <button
                      className="ml-auto text-sm underline-offset-4 hover:underline cursor-pointer"
                      onClick={enterForgotPasswordMode}
                      type="button"
                    >
                      Forgot your password?
                    </button>
                  </div>
                  <Input
                    autoComplete="current-password"
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
                    <FieldError
                      errors={toFieldErrors(field.state.meta.errors)}
                    />
                  ) : null}
                </Field>
              );
            }}
          />
        ) : null}
      </FieldGroup>

      {showVerificationNotice && !isForgotPasswordMode ? (
        <p className="text-sm text-neutral-300">
          Check your inbox for a verification email, then sign in.
        </p>
      ) : null}

      {showPasswordResetNotice && !isForgotPasswordMode ? (
        <p className="text-sm text-muted-foreground">
          Password updated. You can now sign in with your new password.
        </p>
      ) : null}

      {mutation.error && !isForgotPasswordMode ? (
        <p className="text-sm text-destructive">{mutation.error.message}</p>
      ) : null}

      {isEmailNotVerifiedError && !isForgotPasswordMode ? (
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

      {isForgotPasswordMode ? (
        <div className="space-y-2">
          {forgotPasswordFeedback ? (
            <p className="text-sm text-muted-foreground">
              {forgotPasswordFeedback}
            </p>
          ) : null}
          {forgotPasswordError ? (
            <p className="text-sm text-destructive">{forgotPasswordError}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <TurnstileWidget
          action={isForgotPasswordMode ? "request-password-reset" : "sign-in"}
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
        className="w-full border-white bg-white text-neutral-900 hover:bg-neutral-200 cursor-pointer"
        disabled={
          mutation.isPending ||
          googleMutation.isPending ||
          forgotPasswordMutation.isPending ||
          !siteKey ||
          !captchaToken
        }
        type="submit"
      >
        {isForgotPasswordMode
          ? forgotPasswordMutation.isPending
            ? "Sending reset link..."
            : "Send reset link"
          : mutation.isPending
            ? "Signing in..."
            : "Sign in"}
      </Button>

      {isForgotPasswordMode ? (
        <Button
          className="cursor-pointer"
          onBlur={() => backToSignInIconRef.current?.stopAnimation()}
          onClick={leaveForgotPasswordMode}
          onFocus={() => backToSignInIconRef.current?.startAnimation()}
          onMouseEnter={() => backToSignInIconRef.current?.startAnimation()}
          onMouseLeave={() => backToSignInIconRef.current?.stopAnimation()}
          type="button"
          variant="ghost"
        >
          <ArrowLeftIcon ref={backToSignInIconRef} size={16} />
          Back to sign in
        </Button>
      ) : null}
    </form>
  );
};
