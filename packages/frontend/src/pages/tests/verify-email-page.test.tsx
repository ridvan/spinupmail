import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { VerifyEmailPage } from "@/pages/verify-email-page";
import { authClient } from "@/lib/auth";
import { renderWithRouter } from "@/test/router-utils";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  authClient: {
    verifyEmail: vi
      .fn()
      .mockResolvedValue({ data: { status: true }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { user: {}, session: {} } }),
  },
}));

const mockedToastSuccess = vi.mocked(toast.success);
const mockedGetSession = vi.mocked(authClient.getSession);
const mockedVerifyEmail = vi.mocked(authClient.verifyEmail);

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedVerifyEmail.mockResolvedValue({
      data: { status: true },
      error: null,
    } as never);
    mockedGetSession.mockResolvedValue({
      data: { user: {}, session: {} },
    } as never);
  });

  it("shows a missing-token message when no token is present", () => {
    renderWithRouter({
      routes: [{ path: "/verify-email", element: <VerifyEmailPage /> }],
      initialEntries: ["/verify-email"],
    });

    expect(screen.getByText("Verification token is missing.")).toBeTruthy();
  });

  it("verifies a signup email and redirects to the callback path", async () => {
    const callbackURL = encodeURIComponent(
      `${window.location.origin}/inbox?view=inbox`
    );

    const { router } = renderWithRouter({
      routes: [
        { path: "/verify-email", element: <VerifyEmailPage /> },
        { path: "/inbox", element: <div>inbox</div> },
      ],
      initialEntries: [
        `/verify-email?token=abc123&flow=signup&callbackURL=${callbackURL}`,
      ],
    });

    await waitFor(() =>
      expect(mockedVerifyEmail).toHaveBeenCalledWith(
        {
          query: {
            token: "abc123",
          },
        },
        expect.objectContaining({
          cache: "no-store",
        })
      )
    );

    expect(mockedGetSession).toHaveBeenCalledWith(
      {
        query: {
          disableCookieCache: true,
        },
      },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    expect(mockedToastSuccess).toHaveBeenCalledWith(
      "Email verified successfully. You can create an organization or join one to get started."
    );

    await waitFor(() =>
      expect(
        router.state.location.pathname + router.state.location.search
      ).toBe("/inbox?view=inbox")
    );
  });

  it("unwraps old sign-in callback URLs to the real destination", async () => {
    const callbackURL = encodeURIComponent(
      `${window.location.origin}/sign-in?next=%2Fsettings&verification=required`
    );

    const { router } = renderWithRouter({
      routes: [
        { path: "/verify-email", element: <VerifyEmailPage /> },
        { path: "/settings", element: <div>settings</div> },
      ],
      initialEntries: [
        `/verify-email?token=abc123&flow=signup&callbackURL=${callbackURL}`,
      ],
    });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/settings")
    );
  });

  it("shows an invalid-link message when verification fails", async () => {
    mockedVerifyEmail.mockResolvedValue({
      data: null,
      error: { code: "INVALID_TOKEN" },
    } as never);

    renderWithRouter({
      routes: [{ path: "/verify-email", element: <VerifyEmailPage /> }],
      initialEntries: ["/verify-email?token=bad-token"],
    });

    await waitFor(() =>
      expect(
        screen.getByText("This verification link is invalid or expired.")
      ).toBeTruthy()
    );
  });

  it("shows a fallback error when verification succeeds but no session is available", async () => {
    mockedGetSession.mockResolvedValue({
      data: null,
      error: { message: "missing session" },
    } as never);

    renderWithRouter({
      routes: [{ path: "/verify-email", element: <VerifyEmailPage /> }],
      initialEntries: ["/verify-email?token=abc123"],
    });

    await waitFor(() =>
      expect(
        screen.getByText(
          "We could not verify your email right now. Try again or request a new link."
        )
      ).toBeTruthy()
    );
  });

  it("shows a change-email specific success toast", async () => {
    const callbackURL = encodeURIComponent(
      `${window.location.origin}/settings`
    );

    const { router } = renderWithRouter({
      routes: [
        { path: "/verify-email", element: <VerifyEmailPage /> },
        { path: "/settings", element: <div>settings</div> },
      ],
      initialEntries: [
        `/verify-email?token=abc123&flow=change-email&callbackURL=${callbackURL}`,
      ],
    });

    await waitFor(() =>
      expect(mockedToastSuccess).toHaveBeenCalledWith(
        "Email verified successfully. Your email address has been updated."
      )
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/settings")
    );
  });
});
