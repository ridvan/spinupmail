import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AuthLayout,
  AuthPageShell,
} from "@/features/auth/components/auth-layout";
import { authClient } from "@/lib/auth";
import { cn } from "@/lib/utils";

const getSafeRedirectPath = (value: string | null) => {
  if (!value) return "/";

  try {
    const parsed = value.startsWith("/")
      ? new URL(value, window.location.origin)
      : new URL(value);
    if (parsed.origin !== window.location.origin) return "/";

    // Old verification links pointed back to /sign-in. Now that verification
    // auto-signs the user in, unwrap those callbacks to the real destination.
    if (parsed.pathname === "/sign-in") {
      const next = parsed.searchParams.get("next");
      if (next?.startsWith("/") && !next.startsWith("//")) {
        return next;
      }
      return "/";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
};

const getVerificationErrorMessage = (errorCode?: string) => {
  switch (errorCode) {
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      return "This verification link is invalid or expired.";
    case "USER_NOT_FOUND":
      return "We could not find an account for this verification link.";
    default:
      return "We could not verify your email right now. Try again or request a new link.";
  }
};

const getVerificationFlow = (value: string | null) => {
  if (value === "signup" || value === "change-email") return value;
  return null;
};

const getVerificationSuccessMessage = (
  flow: ReturnType<typeof getVerificationFlow>
) => {
  if (flow === "signup") {
    return "Email verified successfully. You can create an organization or join one to get started.";
  }

  if (flow === "change-email") {
    return "Email verified successfully. Your email address has been updated.";
  }

  return "Email verified successfully.";
};

export const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [verificationErrorMessage, setVerificationErrorMessage] = useState<
    string | null
  >(null);

  const token = useMemo(() => {
    const value = searchParams.get("token");
    return value && value.trim().length > 0 ? value.trim() : null;
  }, [searchParams]);

  const redirectPath = useMemo(
    () => getSafeRedirectPath(searchParams.get("callbackURL")),
    [searchParams]
  );
  const flow = getVerificationFlow(searchParams.get("flow"));
  const errorMessage = token
    ? verificationErrorMessage
    : "Verification token is missing.";

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const result = await authClient.verifyEmail(
          {
            query: {
              token,
            },
          },
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        if (result.error) {
          setVerificationErrorMessage(
            getVerificationErrorMessage(result.error.code)
          );
          return;
        }

        const session = await authClient.getSession(
          {
            query: {
              disableCookieCache: true,
            },
          },
          {
            signal: controller.signal,
          }
        );
        if (session.error || !session.data?.session || !session.data?.user) {
          setVerificationErrorMessage(getVerificationErrorMessage());
          return;
        }

        toast.success(getVerificationSuccessMessage(flow));
        await navigate(redirectPath, { replace: true });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setVerificationErrorMessage(getVerificationErrorMessage());
      }
    })();

    return () => {
      controller.abort();
    };
  }, [flow, navigate, redirectPath, token]);

  return (
    <AuthPageShell>
      <AuthLayout
        subtitle={
          errorMessage
            ? "We were unable to complete email verification."
            : "Confirming your email address and signing you in."
        }
        footer={
          <>
            Need a new link? <Link to="/sign-in">Back to sign in</Link>
          </>
        }
      >
        {errorMessage ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              to="/sign-in"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please wait while we verify your email and redirect you.
            </p>
            <Button className="w-full" disabled type="button">
              Verifying email...
            </Button>
          </div>
        )}
      </AuthLayout>
    </AuthPageShell>
  );
};
