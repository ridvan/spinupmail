import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { TwoFactorForm } from "@/features/auth/components/two-factor-form";

const safeNextPath = (value: string | null) => {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
};

export const LoginTwoFactorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams]
  );

  const signInHref =
    nextPath === "/" ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.1448_0_0)] px-4 py-10">
      <AuthLayout
        footer={
          <>
            Entered the wrong account?{" "}
            <Link className="text-neutral-300 hover:text-white" to={signInHref}>
              Back to sign in
            </Link>
          </>
        }
        subtitle="Enter your six digit code to finish signing in"
      >
        <TwoFactorForm
          onSuccess={() => navigate(nextPath, { replace: true })}
        />
      </AuthLayout>
    </div>
  );
};
