import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedLayoutPage } from "@/pages/protected-layout-page";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { AuthUser } from "@/lib/auth";
import { renderWithRouter } from "@/test/router-utils";

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/app-sidebar", () => ({
  AppSidebar: ({ onSignOut }: { onSignOut: () => Promise<void> | void }) => (
    <button
      onClick={() => {
        void onSignOut();
      }}
      type="button"
    >
      Sidebar sign out
    </button>
  ),
}));

vi.mock("@/components/app-command-menu", () => ({
  AppCommandMenu: () => <div>command-menu</div>,
}));

vi.mock("@/components/mode-toggle", () => ({
  ModeToggle: () => <div>mode-toggle</div>,
}));

vi.mock("@/hooks/use-hash-navigation", () => ({
  useHashNavigation: vi.fn(),
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-provider">{children}</div>
  ),
  SidebarInset: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-inset">{children}</div>
  ),
  SidebarTrigger: () => <button type="button">trigger</button>,
}));

const mockedUseAuth = vi.mocked(useAuth);

const buildMockUser = (overrides?: Partial<AuthUser>): AuthUser => ({
  id: "user-1",
  name: "User",
  email: "user@example.com",
  emailVerified: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  twoFactorEnabled: false,
  ...overrides,
});

const buildAuthState = ({
  user,
  isLoading,
  signOut = vi.fn().mockResolvedValue(undefined),
}: {
  user: AuthUser | null;
  isLoading: boolean;
  signOut?: ReturnType<typeof vi.fn>;
}) =>
  ({
    session: null,
    user,
    activeOrganizationId: "org-1",
    isAuthenticated: Boolean(user),
    hasActiveOrganization: true,
    isSigningOut: false,
    isOrganizationSwitching: false,
    isLoading,
    isRefetching: false,
    refreshSession: vi.fn(),
    beginOrganizationSwitch: vi.fn(),
    completeOrganizationSwitch: vi.fn(),
    cancelOrganizationSwitch: vi.fn(),
    signOut,
  }) as unknown as ReturnType<typeof useAuth>;

describe("ProtectedLayoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to sign-in", async () => {
    mockedUseAuth.mockReturnValue(
      buildAuthState({ user: null, isLoading: false })
    );

    const { router } = renderWithRouter({
      routes: [
        {
          path: "/",
          element: <ProtectedLayoutPage />,
          children: [
            {
              index: true,
              element: <div>Overview content</div>,
              handle: { title: "Overview" },
            },
          ],
        },
        { path: "/sign-in", element: <div>sign-in page</div> },
      ],
      initialEntries: ["/"],
    });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/sign-in")
    );
  });

  it("does not redirect while auth is still loading", async () => {
    mockedUseAuth.mockReturnValue(
      buildAuthState({ user: null, isLoading: true })
    );

    const { router } = renderWithRouter({
      routes: [
        {
          path: "/",
          element: <ProtectedLayoutPage />,
          children: [
            {
              index: true,
              element: <div>Overview content</div>,
              handle: { title: "Overview" },
            },
          ],
        },
        { path: "/sign-in", element: <div>sign-in page</div> },
      ],
      initialEntries: ["/"],
    });

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("shows the title resolved from matched route handle", () => {
    mockedUseAuth.mockReturnValue(
      buildAuthState({
        user: buildMockUser(),
        isLoading: false,
      })
    );

    renderWithRouter({
      routes: [
        {
          path: "/",
          element: <ProtectedLayoutPage />,
          children: [
            {
              path: "inbox",
              element: <div>Inbox content</div>,
              handle: { title: "Inbox" },
            },
          ],
        },
      ],
      initialEntries: ["/inbox"],
    });

    expect(screen.getByText("Inbox")).toBeTruthy();
  });

  it("renders the command menu before the theme toggle", () => {
    mockedUseAuth.mockReturnValue(
      buildAuthState({
        user: buildMockUser(),
        isLoading: false,
      })
    );

    renderWithRouter({
      routes: [
        {
          path: "/",
          element: <ProtectedLayoutPage />,
          children: [
            {
              index: true,
              element: <div>Overview content</div>,
              handle: { title: "Overview" },
            },
          ],
        },
      ],
      initialEntries: ["/"],
    });

    const commandMenu = screen.getByText("command-menu");
    const modeToggle = screen.getByText("mode-toggle");

    expect(
      commandMenu.compareDocumentPosition(modeToggle) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("surfaces sign-out errors", async () => {
    const signOut = vi.fn().mockRejectedValue(new Error("Sign out failed"));
    mockedUseAuth.mockReturnValue(
      buildAuthState({
        user: buildMockUser(),
        isLoading: false,
        signOut,
      })
    );

    renderWithRouter({
      routes: [
        {
          path: "/",
          element: <ProtectedLayoutPage />,
          children: [
            {
              index: true,
              element: <div>Overview content</div>,
              handle: { title: "Overview" },
            },
          ],
        },
      ],
      initialEntries: ["/"],
    });

    fireEvent.click(screen.getByRole("button", { name: "Sidebar sign out" }));

    await waitFor(() =>
      expect(screen.getByText("Sign out failed")).toBeTruthy()
    );
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
