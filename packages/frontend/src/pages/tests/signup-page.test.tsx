import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignupPage } from "@/pages/signup-page";
import { renderWithRouter } from "@/test/router-utils";

type SignUpFormProps = {
  onSuccess?: () => Promise<void> | void;
};

let capturedSignUpFormProps: SignUpFormProps | null = null;

vi.mock("@/features/auth/components/sign-up-form", () => ({
  SignUpForm: (props: SignUpFormProps) => {
    capturedSignUpFormProps = props;
    return (
      <button
        onClick={() => {
          void props.onSuccess?.();
        }}
        type="button"
      >
        trigger-signup-success
      </button>
    );
  },
}));

describe("SignupPage", () => {
  beforeEach(() => {
    capturedSignUpFormProps = null;
  });

  it("sanitizes invalid next values and computes sign-in link", () => {
    renderWithRouter({
      routes: [
        { path: "/signup", element: <SignupPage /> },
        { path: "/sign-in", element: <div>sign-in</div> },
      ],
      initialEntries: ["/signup?next=//evil"],
    });

    const signInLink = screen.getByRole("link", { name: "Sign in" });
    expect(signInLink.getAttribute("href")).toBe("/sign-in");
  });

  it("keeps encoded next in sign-in link and success redirect", async () => {
    const { router } = renderWithRouter({
      routes: [
        { path: "/signup", element: <SignupPage /> },
        { path: "/sign-in", element: <div>sign-in</div> },
      ],
      initialEntries: ["/signup?next=/inbox/addr-1"],
    });

    const signInLink = screen.getByRole("link", { name: "Sign in" });
    expect(signInLink.getAttribute("href")).toBe(
      "/sign-in?next=%2Finbox%2Faddr-1"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "trigger-signup-success" })
    );

    await waitFor(() =>
      expect(
        router.state.location.pathname + router.state.location.search
      ).toBe("/sign-in?next=%2Finbox%2Faddr-1&verification=required")
    );

    expect(capturedSignUpFormProps).toBeTruthy();
  });
});
