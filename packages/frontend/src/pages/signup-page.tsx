import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthLayout } from "@/features/auth/components/auth-layout";
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
  const postSignUpPath = `/login?next=${encodeURIComponent(nextPath)}&verification=required`;

  const loginHref =
    nextPath === "/" ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.1448_0_0)] px-4 py-10">
      <AuthLayout
        subtitle="Create your account and start managing disposable email addresses in minutes."
        footer={
          <>
            Already have an account?{" "}
            <Link className="text-neutral-300 hover:text-white" to={loginHref}>
              Sign in
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
        <SignUpForm
          onSuccess={() => navigate(postSignUpPath, { replace: true })}
        />
      </AuthLayout>
    </div>
  );
};
