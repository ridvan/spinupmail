import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import {
  useGoogleSignUpMutation,
  useSignUpMutation,
} from "@/features/auth/hooks/use-auth-mutations";

vi.mock("@/features/auth/hooks/use-auth-mutations", () => ({
  useGoogleSignUpMutation: vi.fn(),
  useSignUpMutation: vi.fn(),
}));

vi.mock("@/features/auth/components/turnstile-widget", async () => {
  const React = await import("react");

  return {
    TurnstileWidget: React.forwardRef<
      HTMLDivElement,
      { onTokenChange?: (token: string | null) => void }
    >(function MockTurnstileWidget({ onTokenChange }, _ref) {
      React.useEffect(() => {
        onTokenChange?.("captcha-token");
      }, [onTokenChange]);

      return <div data-testid="turnstile-widget" />;
    }),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn(),
  },
}));

const mockedUseSignUpMutation = vi.mocked(useSignUpMutation);
const mockedUseGoogleSignUpMutation = vi.mocked(useGoogleSignUpMutation);
const mockedToastSuccess = vi.mocked(toast.success);

describe("SignUpForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-site-key");

    mockedUseGoogleSignUpMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useGoogleSignUpMutation>);
  });

  it("shows a success toast after email signup completes", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    const onSuccess = vi.fn();

    mockedUseSignUpMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useSignUpMutation>);

    render(<SignUpForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ada Lovelace" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "supersecret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "supersecret123",
        captchaToken: "captcha-token",
      })
    );
    expect(mockedToastSuccess).toHaveBeenCalledWith(
      "Verification email sent. Check your inbox to continue."
    );
    expect(onSuccess).toHaveBeenCalled();
  });
});
