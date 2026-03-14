import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInTwoFactorPage } from "@/pages/sign-in-two-factor-page";
import { renderWithRouter } from "@/test/router-utils";

type TwoFactorFormProps = {
  onSuccess?: () => Promise<void> | void;
};

let capturedTwoFactorFormProps: TwoFactorFormProps | null = null;

vi.mock("@/features/auth/components/two-factor-form", () => ({
  TwoFactorForm: (props: TwoFactorFormProps) => {
    capturedTwoFactorFormProps = props;
    return (
      <button
        onClick={() => {
          void props.onSuccess?.();
        }}
        type="button"
      >
        trigger-2fa-success
      </button>
    );
  },
}));

describe("SignInTwoFactorPage", () => {
  beforeEach(() => {
    capturedTwoFactorFormProps = null;
  });

  it("sanitizes invalid next for back-to-sign-in link", () => {
    renderWithRouter({
      routes: [
        { path: "/sign-in/2fa", element: <SignInTwoFactorPage /> },
        { path: "/sign-in", element: <div>sign-in</div> },
      ],
      initialEntries: ["/sign-in/2fa?next=//evil"],
    });

    const backLink = screen.getByRole("link", { name: "Back to sign in" });
    expect(backLink.getAttribute("href")).toBe("/sign-in");
  });

  it("keeps encoded next in back link and navigates to sanitized next on success", async () => {
    const { router } = renderWithRouter({
      routes: [
        { path: "/sign-in/2fa", element: <SignInTwoFactorPage /> },
        { path: "/sign-in", element: <div>sign-in</div> },
        { path: "/inbox", element: <div>inbox</div> },
      ],
      initialEntries: ["/sign-in/2fa?next=/inbox"],
    });

    const backLink = screen.getByRole("link", { name: "Back to sign in" });
    expect(backLink.getAttribute("href")).toBe("/sign-in?next=%2Finbox");

    fireEvent.click(
      screen.getByRole("button", { name: "trigger-2fa-success" })
    );

    await waitFor(() => expect(router.state.location.pathname).toBe("/inbox"));
    expect(capturedTwoFactorFormProps).toBeTruthy();
  });
});
