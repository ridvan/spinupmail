import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  AuthLayout,
  AuthPageShell,
} from "@/features/auth/components/auth-layout";
import { TwoFactorForm } from "@/features/auth/components/two-factor-form";

const safeNextPath = (value: string | null) => {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
};

export const SignInTwoFactorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams]
  );

  const signInHref =
    nextPath === "/"
      ? "/sign-in"
      : `/sign-in?next=${encodeURIComponent(nextPath)}`;

  return (
    <AuthPageShell>
      <AuthLayout
        footer={
          <>
            Entered the wrong account?{" "}
            <Link to={signInHref}>Back to sign in</Link>
          </>
        }
        subtitle="Enter your six digit code to finish signing in"
      >
        <TwoFactorForm
          onSuccess={() => navigate(nextPath, { replace: true })}
        />
      </AuthLayout>
    </AuthPageShell>
  );
};
