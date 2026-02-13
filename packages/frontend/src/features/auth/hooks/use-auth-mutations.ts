import { useMutation } from "@tanstack/react-query";
import {
  type SignInFormValues,
  type SignUpFormValues,
} from "@/features/auth/types/auth.types";
import { authClient } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

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

const getSignInCallbackURL = () => {
  if (typeof window === "undefined") return undefined;
  return window.location.href;
};

const getSignUpCallbackURL = () => {
  if (typeof window === "undefined") return undefined;
  const currentUrl = new URL(window.location.href);
  const loginUrl = new URL("/login", window.location.origin);
  const next = currentUrl.searchParams.get("next");
  if (next) {
    loginUrl.searchParams.set("next", next);
  }
  return loginUrl.toString();
};

const getResendVerificationCallbackURL = () => {
  if (typeof window === "undefined") return undefined;
  const url = new URL("/login", window.location.origin);
  const current = new URL(window.location.href);
  const next = current.searchParams.get("next");
  if (next) {
    url.searchParams.set("next", next);
  }
  return url.toString();
};

export const useSignInMutation = () => {
  return useMutation({
    mutationFn: async (values: SignInFormValues) => {
      const result = await authClient.signIn.email({
        email: values.email.trim(),
        password: values.password,
        callbackURL: getSignInCallbackURL(),
      });

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
      const result = await authClient.signUp.email({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        callbackURL: getSignUpCallbackURL(),
      });

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
