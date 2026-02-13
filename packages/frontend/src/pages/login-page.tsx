import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignInForm } from "@/features/auth/components/sign-in-form";

const safeNextPath = (value: string | null) => {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams]
  );

  const signupHref =
    nextPath === "/"
      ? "/signup"
      : `/signup?next=${encodeURIComponent(nextPath)}`;
  const twoFactorHref =
    nextPath === "/"
      ? "/login/2fa"
      : `/login/2fa?next=${encodeURIComponent(nextPath)}`;

  return (
    <AuthShell
      altCta="Create one"
      altHref={signupHref}
      altLabel="Need an account?"
      subtitle="Access your inbox workspace with your email and password."
      title="Sign in"
    >
      <SignInForm
        onSuccess={() => navigate(nextPath, { replace: true })}
        onTwoFactorRequired={() => navigate(twoFactorHref, { replace: true })}
      />
    </AuthShell>
  );
};
