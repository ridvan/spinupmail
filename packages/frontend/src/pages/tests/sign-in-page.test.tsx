import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SignInPage } from "@/pages/sign-in-page";
import { renderWithRouter } from "@/test/router-utils";

type SignInFormProps = {
  onSuccess?: () => Promise<void> | void;
  onTwoFactorRequired?: () => Promise<void> | void;
  showVerificationNotice?: boolean;
  showPasswordResetNotice?: boolean;
};

let capturedSignInFormProps: SignInFormProps | null = null;

vi.mock("@/features/auth/components/sign-in-form", () => ({
  SignInForm: (props: SignInFormProps) => {
    capturedSignInFormProps = props;
    return (
      <div>
        <button
          onClick={() => {
            void props.onSuccess?.();
          }}
          type="button"
        >
          trigger-success
        </button>
        <button
          onClick={() => {
            void props.onTwoFactorRequired?.();
          }}
          type="button"
        >
          trigger-2fa
        </button>
      </div>
    );
  },
}));

describe("SignInPage", () => {
  beforeEach(() => {
    capturedSignInFormProps = null;
  });

  it("sanitizes invalid next values and routes callbacks safely", async () => {
    const { router } = renderWithRouter({
      routes: [
        { path: "/sign-in", element: <SignInPage /> },
        { path: "/signup", element: <div>signup</div> },
        { path: "/sign-in/2fa", element: <div>2fa</div> },
        { path: "/", element: <div>home</div> },
      ],
      initialEntries: [
        "/sign-in?next=//evil&verification=required&passwordReset=success",
      ],
    });

    const signUpLink = screen.getByRole("link", { name: "Sign up" });
    expect(signUpLink.getAttribute("href")).toBe("/signup");

    fireEvent.click(screen.getByRole("button", { name: "trigger-success" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("builds encoded next links for sign-up and 2fa", async () => {
    const { router } = renderWithRouter({
      routes: [
        { path: "/sign-in", element: <SignInPage /> },
        { path: "/signup", element: <div>signup</div> },
        { path: "/sign-in/2fa", element: <div>2fa</div> },
      ],
      initialEntries: ["/sign-in?next=/inbox/my-address"],
    });

    const signUpLink = screen.getByRole("link", { name: "Sign up" });
    expect(signUpLink.getAttribute("href")).toBe(
      "/signup?next=%2Finbox%2Fmy-address"
    );

    fireEvent.click(screen.getByRole("button", { name: "trigger-2fa" }));
    await waitFor(() =>
      expect(
        router.state.location.pathname + router.state.location.search
      ).toBe("/sign-in/2fa?next=%2Finbox%2Fmy-address")
    );
  });

  it("forwards verification and password reset flags to the form", () => {
    renderWithRouter({
      routes: [{ path: "/sign-in", element: <SignInPage /> }],
      initialEntries: ["/sign-in?verification=required&passwordReset=success"],
    });

    expect(capturedSignInFormProps?.showVerificationNotice).toBe(true);
    expect(capturedSignInFormProps?.showPasswordResetNotice).toBe(true);
  });
});
