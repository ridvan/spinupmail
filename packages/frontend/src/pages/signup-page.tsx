import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

const safeNextPath = (value: string | null) => {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
};

export const SignupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams]
  );
  const postSignUpPath =
    nextPath === "/" ? "/onboarding/organization" : nextPath;

  const loginHref =
    nextPath === "/" ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <AuthShell
      altCta="Sign in"
      altHref={loginHref}
      altLabel="Already have an account?"
      subtitle="Create your workspace and start managing disposable inboxes in minutes."
      title="Create account"
    >
      <SignUpForm
        onSuccess={() => navigate(postSignUpPath, { replace: true })}
      />
    </AuthShell>
  );
};
