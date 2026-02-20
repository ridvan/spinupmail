import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { TwoFactorPanel } from "@/features/settings/components/two-factor-panel";
import { authClient } from "@/lib/auth";

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authClient: {
    twoFactor: {
      enable: vi.fn(),
      verifyTotp: vi.fn(),
      generateBackupCodes: vi.fn(),
      disable: vi.fn(),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedEnable = vi.mocked(authClient.twoFactor.enable);
const mockedDisable = vi.mocked(authClient.twoFactor.disable);
const mockedToastPromise = vi.mocked(toast.promise);

const buildMockUser = (twoFactorEnabled: boolean) => ({
  id: "user-1",
  name: "Jane Doe",
  email: "jane@example.com",
  emailVerified: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  twoFactorEnabled,
});

const buildAuthState = ({
  twoFactorEnabled,
  refreshSession = vi.fn().mockResolvedValue(undefined),
}: {
  twoFactorEnabled: boolean;
  refreshSession?: ReturnType<typeof vi.fn>;
}): ReturnType<typeof useAuth> => ({
  session: null,
  user: buildMockUser(twoFactorEnabled),
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

const resolveToastPromise = <T,>(
  promise: Parameters<typeof toast.promise>[0]
): Promise<T> => {
  if (typeof promise === "function") {
    return promise() as Promise<T>;
  }
  return promise as Promise<T>;
};

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("TwoFactorPanel", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedToastPromise.mockImplementation(((
      promise: Parameters<typeof toast.promise>[0]
    ) => resolveToastPromise(promise)) as unknown as typeof toast.promise);
    mockedEnable.mockResolvedValue({ error: null, data: null });
    mockedDisable.mockResolvedValue({ error: null, data: null });
  });

  it("renders status badges with icons for enabled and disabled states", () => {
    mockedUseAuth.mockReturnValue(buildAuthState({ twoFactorEnabled: true }));

    const { unmount } = render(<TwoFactorPanel />);
    const enabledBadge = screen
      .getByText("Enabled")
      .closest("[data-slot=badge]");
    expect(enabledBadge).toBeTruthy();
    expect(enabledBadge?.querySelector("svg")).toBeTruthy();

    unmount();

    mockedUseAuth.mockReturnValue(buildAuthState({ twoFactorEnabled: false }));

    render(<TwoFactorPanel />);
    const disabledBadge = screen
      .getByText("Disabled")
      .closest("[data-slot=badge]");
    expect(disabledBadge).toBeTruthy();
    expect(disabledBadge?.querySelector("svg")).toBeTruthy();
  });

  it("starts 2FA setup and shows verification UI", async () => {
    mockedUseAuth.mockReturnValue(buildAuthState({ twoFactorEnabled: false }));
    mockedEnable.mockResolvedValue({
      error: null,
      data: {
        totpURI: "otpauth://totp/Spinupmail:Jane?secret=ABCDEF",
        backupCodes: ["code-one", "code-two"],
      },
    });

    render(<TwoFactorPanel />);

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enable 2FA" }));

    await waitFor(() =>
      expect(mockedEnable).toHaveBeenCalledWith({ password: "password-123" })
    );
    await waitFor(() => expect(screen.getByText("Scan QR code")).toBeTruthy());
    expect(screen.getByText("Manual setup key")).toBeTruthy();
  });

  it("disables 2FA after confirmation input and refreshes session", async () => {
    const refreshSession = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(
      buildAuthState({ twoFactorEnabled: true, refreshSession })
    );

    render(<TwoFactorPanel />);

    const disableButton = screen.getByRole("button", { name: "Disable 2FA" });
    const disableForm = disableButton.closest("form");
    expect(disableForm).toBeTruthy();
    if (!disableForm) throw new Error("Disable 2FA form not found");

    fireEvent.change(within(disableForm).getByLabelText("Current password"), {
      target: { value: "password-456" },
    });
    fireEvent.click(
      within(disableForm).getByRole("button", { name: "Disable 2FA" })
    );

    await waitFor(() =>
      expect(mockedDisable).toHaveBeenCalledWith({ password: "password-456" })
    );
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });
});
