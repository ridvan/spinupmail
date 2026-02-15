import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthLayout } from "@/features/auth/components/auth-layout";
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
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);

  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams]
  );
  const needsVerification = searchParams.get("verification") === "required";
  const passwordResetSuccess = searchParams.get("passwordReset") === "success";

  const signupHref =
    nextPath === "/"
      ? "/signup"
      : `/signup?next=${encodeURIComponent(nextPath)}`;
  const twoFactorHref =
    nextPath === "/"
      ? "/login/2fa"
      : `/login/2fa?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.1448_0_0)] px-4 py-10">
      <AuthLayout
        subtitle={
          isForgotPasswordMode ? "" : "Welcome back! Please login to continue."
        }
        footer={
          <>
            Don&apos;t have an account?{" "}
            <Link className="text-neutral-300 hover:text-white" to={signupHref}>
              Sign up
            </Link>
          </>
        }
        legal={
          <>
            By clicking continue, you agree to our{" "}
            <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
          </>
        }
      >
        <SignInForm
          isForgotPasswordMode={isForgotPasswordMode}
          onSuccess={() => navigate(nextPath, { replace: true })}
          onTwoFactorRequired={() => navigate(twoFactorHref, { replace: true })}
          showPasswordResetNotice={passwordResetSuccess}
          showVerificationNotice={needsVerification}
          onForgotPasswordModeChange={setIsForgotPasswordMode}
        />
      </AuthLayout>
    </div>
  );
};
