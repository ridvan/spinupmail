import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { UserProfilePanel } from "@/features/settings/components/user-profile-panel";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import { authClient } from "@/lib/auth";
import { TestQueryProvider } from "@/test/render-utils";

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authClient: {
    updateUser: vi.fn(),
    changeEmail: vi.fn(),
  },
}));

vi.mock("@/features/timezone/hooks/use-timezone", () => ({
  useTimezone: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseTimezone = vi.mocked(useTimezone);
const mockedUpdateUser = vi.mocked(authClient.updateUser);
const mockedChangeEmail = vi.mocked(authClient.changeEmail);
const mockedToastPromise = vi.mocked(toast.promise);
const buildMockUser = (name: string) => ({
  id: "user-1",
  name,
  email: "jane@example.com",
  emailVerified: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  twoFactorEnabled: false,
});

const renderUserProfilePanel = () =>
  render(
    <TestQueryProvider>
      <UserProfilePanel />
    </TestQueryProvider>
  );

const buildAuthenticatedAuthState = (refreshSession = vi.fn()) => ({
  session: null,
  user: buildMockUser("Jane Doe"),
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

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("UserProfilePanel", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "UTC",
      savedTimeZone: null,
      sessionTimeZone: "America/New_York",
      source: "browser",
      isSaving: false,
      error: null,
      setTimeZone: vi.fn(),
      clearTimeZone: vi.fn(),
    });
  });

  it("updates the user name and refreshes the session", async () => {
    const refreshSession = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(buildAuthenticatedAuthState(refreshSession));
    mockedUpdateUser.mockResolvedValue({ error: null });

    renderUserProfilePanel();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "  Jane Smith  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedUpdateUser).toHaveBeenCalledWith({ name: "Jane Smith" })
    );
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(mockedToastPromise).toHaveBeenCalledWith(
      expect.any(Promise),
      expect.objectContaining({
        loading: "Saving profile...",
        success: "Profile saved.",
      })
    );
  });

  it("keeps save disabled when name is too short", () => {
    mockedUseAuth.mockReturnValue(buildAuthenticatedAuthState());
    mockedUpdateUser.mockResolvedValue({ error: null });

    renderUserProfilePanel();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "A" },
    });

    const saveButton = screen.getByRole("button", { name: "Save changes" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("switches email field into editable mode with save action", () => {
    mockedUseAuth.mockReturnValue(buildAuthenticatedAuthState());
    mockedChangeEmail.mockResolvedValue({ error: null });

    renderUserProfilePanel();

    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    expect(emailInput.readOnly).toBe(true);
    expect(emailInput.value).toBe("jane@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Change email" }));

    const editableEmailInput = screen.getByLabelText(
      "Email"
    ) as HTMLInputElement;
    expect(editableEmailInput.readOnly).toBe(false);
    expect(editableEmailInput.value).toBe("");
    expect(editableEmailInput.placeholder).toBe("Enter new address...");
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("finds and selects a timezone with space-separated search text", async () => {
    mockedUseAuth.mockReturnValue(buildAuthenticatedAuthState());
    mockedUpdateUser.mockResolvedValue({ error: null });

    renderUserProfilePanel();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "UTC" }));

    const searchInput = screen.getByPlaceholderText(
      "Search timezone (e.g. America/New_York)"
    );
    fireEvent.change(searchInput, { target: { value: "new york" } });

    const newYorkOption = await screen.findByText("America/New_York");
    fireEvent.click(newYorkOption);

    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("Search timezone (e.g. America/New_York)")
      ).toBeNull()
    );
    expect(
      screen.getByRole("button", { name: "America/New_York" })
    ).toBeTruthy();
  });

  it("supports arrow navigation and enter-to-select in timezone results", async () => {
    mockedUseAuth.mockReturnValue(buildAuthenticatedAuthState());
    mockedUpdateUser.mockResolvedValue({ error: null });

    renderUserProfilePanel();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "UTC" }));

    const searchInput = screen.getByPlaceholderText(
      "Search timezone (e.g. America/New_York)"
    );
    fireEvent.change(searchInput, { target: { value: "new york" } });

    await screen.findByText("America/New_York");
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    fireEvent.keyDown(searchInput, { key: "Enter" });

    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("Search timezone (e.g. America/New_York)")
      ).toBeNull()
    );
    expect(
      screen.getByRole("button", { name: "America/New_York" })
    ).toBeTruthy();
  });
});
