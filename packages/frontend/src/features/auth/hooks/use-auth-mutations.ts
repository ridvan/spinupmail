import { useMutation } from "@tanstack/react-query";
import {
  type SignInFormValues,
  type SignUpFormValues,
} from "@/features/auth/types/auth.types";
import { authClient } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const safeNextPath = (value: string | null) => {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
};

const getAuthErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error !== "object" || !error) return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
};

const getAuthErrorCode = (error: unknown) => {
  if (typeof error !== "object" || !error) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : undefined;
};

export class AuthMutationError extends Error {
  code?: string;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    options?: { code?: string; retryAfterSeconds?: number }
  ) {
    super(message);
    this.name = "AuthMutationError";
    this.code = options?.code;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

const getPostVerificationCallbackURL = () => {
  if (typeof window === "undefined") return undefined;
  const currentUrl = new URL(window.location.href);
  const nextPath = safeNextPath(currentUrl.searchParams.get("next"));
  return new URL(nextPath, window.location.origin).toString();
};

const getSocialAuthCallbackURL = () => {
  if (typeof window === "undefined") return undefined;
  const currentUrl = new URL(window.location.href);
  const nextPath = safeNextPath(currentUrl.searchParams.get("next"));
  return new URL(nextPath, window.location.origin).toString();
};

const getSocialAuthErrorCallbackURL = () => {
  if (typeof window === "undefined") return undefined;
  return window.location.href;
};

const getResendVerificationCallbackURL = () => {
  return getPostVerificationCallbackURL();
};

const getResetPasswordRedirectURL = () => {
  if (typeof window === "undefined") return undefined;
  return new URL("/reset-password", window.location.origin).toString();
};

export const useSignInMutation = () => {
  return useMutation({
    mutationFn: async (values: SignInFormValues) => {
      const result = await authClient.signIn.email(
        {
          email: values.email.trim(),
          password: values.password,
          callbackURL: getPostVerificationCallbackURL(),
        },
        {
          headers: {
            "x-captcha-response": values.captchaToken,
          },
        }
      );

      if (result.error) {
        throw new AuthMutationError(
          getAuthErrorMessage(result.error, "Sign in failed"),
          {
            code: getAuthErrorCode(result.error),
          }
        );
      }

      const signInData = result.data as { twoFactorRedirect?: boolean } | null;
      if (signInData?.twoFactorRedirect) {
        return { requiresTwoFactor: true };
      }

      await authClient.getSession();
      return { requiresTwoFactor: false };
    },
  });
};

export const useSignUpMutation = () => {
  return useMutation({
    mutationFn: async (values: SignUpFormValues) => {
      const result = await authClient.signUp.email(
        {
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          callbackURL: getPostVerificationCallbackURL(),
        },
        {
          headers: {
            "x-captcha-response": values.captchaToken,
          },
        }
      );

      if (result.error) {
        throw new AuthMutationError(
          getAuthErrorMessage(result.error, "Sign up failed"),
          {
            code: getAuthErrorCode(result.error),
          }
        );
      }

      return result.data;
    },
  });
};

export const useGoogleSignInMutation = () => {
  return useMutation({
    mutationFn: async () => {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: getSocialAuthCallbackURL(),
        errorCallbackURL: getSocialAuthErrorCallbackURL(),
      });

      if (result.error) {
        throw new AuthMutationError(
          getAuthErrorMessage(result.error, "Google sign in failed"),
          {
            code: getAuthErrorCode(result.error),
          }
        );
      }

      return result.data;
    },
  });
};

export const useGoogleSignUpMutation = () => {
  return useMutation({
    mutationFn: async () => {
      const callbackURL = getSocialAuthCallbackURL();
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL,
        newUserCallbackURL: callbackURL,
        errorCallbackURL: getSocialAuthErrorCallbackURL(),
        requestSignUp: true,
      });

      if (result.error) {
        throw new AuthMutationError(
          getAuthErrorMessage(result.error, "Google sign up failed"),
          {
            code: getAuthErrorCode(result.error),
          }
        );
      }

      return result.data;
    },
  });
};

export const useResendVerificationEmailMutation = () => {
  return useMutation({
    mutationFn: async (values: { email: string }) => {
      const response = await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email.trim(),
          callbackURL: getResendVerificationCallbackURL(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        status?: boolean;
        cooldownSeconds?: number;
        error?: string;
        retryAfterSeconds?: number;
      } | null;

      if (!response.ok) {
        throw new AuthMutationError(
          payload?.error || "Unable to resend verification email",
          {
            retryAfterSeconds: payload?.retryAfterSeconds,
          }
        );
      }

      return {
        cooldownSeconds: payload?.cooldownSeconds ?? 60,
      };
    },
  });
};

export const useRequestPasswordResetMutation = () => {
  return useMutation({
    mutationFn: async (values: { email: string; captchaToken: string }) => {
      const result = await authClient.requestPasswordReset(
        {
          email: values.email.trim(),
          redirectTo: getResetPasswordRedirectURL(),
        },
        {
          headers: {
            "x-captcha-response": values.captchaToken,
          },
        }
      );

      if (result.error) {
        throw new AuthMutationError(
          getAuthErrorMessage(result.error, "Unable to send reset link"),
          {
            code: getAuthErrorCode(result.error),
          }
        );
      }

      return result.data;
    },
  });
};

export const useResetPasswordMutation = () => {
  return useMutation({
    mutationFn: async (values: { token: string; newPassword: string }) => {
      const result = await authClient.resetPassword({
        token: values.token,
        newPassword: values.newPassword,
      });

      if (result.error) {
        throw new AuthMutationError(
          getAuthErrorMessage(result.error, "Unable to reset password"),
          {
            code: getAuthErrorCode(result.error),
          }
        );
      }

      return result.data;
    },
  });
};
