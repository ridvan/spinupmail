import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useSendPasswordSetupEmailMutation } from "@/features/auth/hooks/use-auth-mutations";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ChangePasswordPanel } from "@/features/settings/components/change-password-panel";
import { authClient } from "@/lib/auth";
import { TestQueryProvider } from "@/test/render-utils";

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/auth/hooks/use-auth-mutations", () => ({
  useSendPasswordSetupEmailMutation: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authClient: {
    changePassword: vi.fn(),
    listAccounts: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedChangePassword = vi.mocked(authClient.changePassword);
const mockedListAccounts = vi.mocked(authClient.listAccounts);
const mockedUseSendPasswordSetupEmailMutation = vi.mocked(
  useSendPasswordSetupEmailMutation
);
const mockedToastPromise = vi.mocked(toast.promise);
const buildMockUser = () => ({
  id: "user-1",
  name: "Jane Doe",
  email: "jane@example.com",
  emailVerified: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  twoFactorEnabled: false,
});

const renderChangePasswordPanel = (
  props?: Partial<ComponentProps<typeof ChangePasswordPanel>>
) =>
  render(
    <TestQueryProvider>
      <ChangePasswordPanel {...props} />
    </TestQueryProvider>
  );

describe("ChangePasswordPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListAccounts.mockResolvedValue({
      data: [{ providerId: "credential" }],
      error: null,
    });
    mockedUseSendPasswordSetupEmailMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ status: true }),
      isPending: false,
    } as unknown as ReturnType<typeof useSendPasswordSetupEmailMutation>);
  });

  it("updates password and refreshes session", async () => {
    const refreshSession = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      session: null,
      user: buildMockUser(),
      activeOrganizationId: null,
      isAuthenticated: true,
      hasActiveOrganization: false,
      isSigningOut: false,
      isOrganizationSwitching: false,
      isLoading: false,
      isRefetching: false,
      refreshSession,
      beginOrganizationSwitch: vi.fn(),
      completeOrganizationSwitch: vi.fn(),
      cancelOrganizationSwitch: vi.fn(),
      signOut: vi.fn(),
    });
    mockedChangePassword.mockResolvedValue({ error: null });

    renderChangePasswordPanel();

    fireEvent.change(await screen.findByLabelText("Current password"), {
      target: { value: "old-password-123" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(mockedChangePassword).toHaveBeenCalledWith({
        currentPassword: "old-password-123",
        newPassword: "new-password-123",
        revokeOtherSessions: true,
      })
    );
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(mockedToastPromise).toHaveBeenCalledWith(
      expect.any(Promise),
      expect.objectContaining({
        loading: "Updating password...",
        success: "Password updated.",
      })
    );
  });

  it("disables submit when passwords do not match", async () => {
    mockedUseAuth.mockReturnValue({
      session: null,
      user: buildMockUser(),
      activeOrganizationId: null,
      isAuthenticated: true,
      hasActiveOrganization: false,
      isSigningOut: false,
      isOrganizationSwitching: false,
      isLoading: false,
      isRefetching: false,
      refreshSession: vi.fn(),
      beginOrganizationSwitch: vi.fn(),
      completeOrganizationSwitch: vi.fn(),
      cancelOrganizationSwitch: vi.fn(),
      signOut: vi.fn(),
    });
    mockedChangePassword.mockResolvedValue({ error: null });

    renderChangePasswordPanel();

    fireEvent.change(await screen.findByLabelText("Current password"), {
      target: { value: "old-password-123" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "different-password-456" },
    });

    const submitButton = screen.getByRole("button", {
      name: "Update password",
    });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("applies wrapperClassName when rendering with the default card wrapper", () => {
    mockedUseAuth.mockReturnValue({
      session: null,
      user: buildMockUser(),
      activeOrganizationId: null,
      isAuthenticated: true,
      hasActiveOrganization: false,
      isSigningOut: false,
      isOrganizationSwitching: false,
      isLoading: false,
      isRefetching: false,
      refreshSession: vi.fn(),
      beginOrganizationSwitch: vi.fn(),
      completeOrganizationSwitch: vi.fn(),
      cancelOrganizationSwitch: vi.fn(),
      signOut: vi.fn(),
    });

    renderChangePasswordPanel({
      wrapperClassName: "password-wrapper-test",
    });

    expect(
      screen.getByText("Password").closest(".password-wrapper-test")
    ).toBeTruthy();
  });

  it("emails a password setup link for accounts without credentials", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ status: true });

    mockedUseAuth.mockReturnValue({
      session: null,
      user: buildMockUser(),
      activeOrganizationId: null,
      isAuthenticated: true,
      hasActiveOrganization: false,
      isSigningOut: false,
      isOrganizationSwitching: false,
      isLoading: false,
      isRefetching: false,
      refreshSession: vi.fn(),
      beginOrganizationSwitch: vi.fn(),
      completeOrganizationSwitch: vi.fn(),
      cancelOrganizationSwitch: vi.fn(),
      signOut: vi.fn(),
    });
    mockedListAccounts.mockResolvedValue({
      data: [{ providerId: "google" }],
      error: null,
    });
    mockedUseSendPasswordSetupEmailMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useSendPasswordSetupEmailMutation>);

    renderChangePasswordPanel();

    await screen.findByText(/doesn't have a password yet/i);
    expect(screen.queryByLabelText("Current password")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Email password setup link" })
    );

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mockedToastPromise).toHaveBeenCalledWith(
      expect.any(Promise),
      expect.objectContaining({
        loading: "Sending setup link...",
        success: "Password setup link sent to jane@example.com.",
      })
    );
  });
});
