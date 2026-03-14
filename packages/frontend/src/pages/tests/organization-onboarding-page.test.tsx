import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationOnboardingPage } from "@/pages/organization-onboarding-page";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useAcceptInvitationMutation,
  useCreateOrganizationMutation,
  useOrganizationInvitationQuery,
  useOrganizationsQuery,
  useSetActiveOrganizationMutation,
  useUserInvitationsQuery,
} from "@/features/organization/hooks/use-organizations";
import { renderWithRouter } from "@/test/router-utils";

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/organization/hooks/use-organizations", () => ({
  useOrganizationInvitationQuery: vi.fn(),
  useUserInvitationsQuery: vi.fn(),
  useOrganizationsQuery: vi.fn(),
  useCreateOrganizationMutation: vi.fn(),
  useSetActiveOrganizationMutation: vi.fn(),
  useAcceptInvitationMutation: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseOrganizationInvitationQuery = vi.mocked(
  useOrganizationInvitationQuery
);
const mockedUseUserInvitationsQuery = vi.mocked(useUserInvitationsQuery);
const mockedUseOrganizationsQuery = vi.mocked(useOrganizationsQuery);
const mockedUseCreateOrganizationMutation = vi.mocked(
  useCreateOrganizationMutation
);
const mockedUseSetActiveOrganizationMutation = vi.mocked(
  useSetActiveOrganizationMutation
);
const mockedUseAcceptInvitationMutation = vi.mocked(
  useAcceptInvitationMutation
);

const createOrganizationMutateAsync = vi.fn();
const setActiveOrganizationMutateAsync = vi.fn();
const acceptInvitationMutateAsync = vi.fn();
const refreshSession = vi.fn();

const renderPage = (initialEntries: string[]) =>
  renderWithRouter({
    routes: [
      {
        path: "/onboarding/organization",
        element: <OrganizationOnboardingPage />,
      },
      { path: "/", element: <div>home</div> },
      { path: "/inbox", element: <div>inbox</div> },
    ],
    initialEntries,
  });

describe("OrganizationOnboardingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    refreshSession.mockResolvedValue(undefined);
    createOrganizationMutateAsync.mockResolvedValue({ id: "org-new" });
    setActiveOrganizationMutateAsync.mockResolvedValue({ success: true });
    acceptInvitationMutateAsync.mockResolvedValue({ success: true });

    mockedUseAuth.mockReturnValue({
      activeOrganizationId: null,
      refreshSession,
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseOrganizationInvitationQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrganizationInvitationQuery>);

    mockedUseUserInvitationsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useUserInvitationsQuery>);

    mockedUseOrganizationsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrganizationsQuery>);

    mockedUseCreateOrganizationMutation.mockReturnValue({
      mutateAsync: createOrganizationMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateOrganizationMutation>);

    mockedUseSetActiveOrganizationMutation.mockReturnValue({
      mutateAsync: setActiveOrganizationMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useSetActiveOrganizationMutation>);

    mockedUseAcceptInvitationMutation.mockReturnValue({
      mutateAsync: acceptInvitationMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useAcceptInvitationMutation>);
  });

  it("creates an organization, refreshes session, and navigates to sanitized next", async () => {
    const { router } = renderPage(["/onboarding/organization?next=//evil"]);

    fireEvent.change(screen.getByPlaceholderText("Acme QA Team"), {
      target: { value: "My Org" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create organization" })
    );

    await waitFor(() =>
      expect(createOrganizationMutateAsync).toHaveBeenCalledWith("My Org")
    );
    expect(refreshSession).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("accepts invitation from explicit invitation query and navigates", async () => {
    mockedUseOrganizationInvitationQuery.mockReturnValue({
      data: {
        id: "inv-query",
        organizationName: "Acme",
        inviterEmail: "owner@example.com",
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrganizationInvitationQuery>);

    const { router } = renderPage([
      "/onboarding/organization?invitationId=inv-query&next=/inbox",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Accept invite" }));

    await waitFor(() =>
      expect(acceptInvitationMutateAsync).toHaveBeenCalledWith("inv-query")
    );
    expect(refreshSession).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(router.state.location.pathname).toBe("/inbox"));
  });

  it("accepts invitation from pending invitation list and filters non-pending entries", async () => {
    mockedUseUserInvitationsQuery.mockReturnValue({
      data: [
        {
          id: "inv-pending",
          organizationName: "Pending Org",
          role: "member",
          status: "pending",
        },
        {
          id: "inv-accepted",
          organizationName: "Accepted Org",
          role: "member",
          status: "accepted",
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useUserInvitationsQuery>);

    const { router } = renderPage(["/onboarding/organization?next=/inbox"]);

    expect(screen.getByText("Pending Org")).toBeTruthy();
    expect(screen.queryByText("Accepted Org")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() =>
      expect(acceptInvitationMutateAsync).toHaveBeenCalledWith("inv-pending")
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/inbox"));
  });

  it("shows existing organizations section when no active org exists and orgs are available", () => {
    mockedUseOrganizationsQuery.mockReturnValue({
      data: [
        { id: "org-1", name: "Acme", slug: "acme" },
        { id: "org-2", name: "Beta", slug: "beta" },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrganizationsQuery>);

    renderPage(["/onboarding/organization"]);

    expect(screen.getByText("Already have organizations?")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Use" })).toHaveLength(2);
  });

  it("hides existing organizations section when active organization already exists", () => {
    mockedUseOrganizationsQuery.mockReturnValue({
      data: [{ id: "org-1", name: "Acme", slug: "acme" }],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrganizationsQuery>);
    mockedUseUserInvitationsQuery.mockReturnValue({
      data: [
        {
          id: "inv-1",
          organizationName: "Shared Org",
          role: "member",
          status: "pending",
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useUserInvitationsQuery>);
    mockedUseAuth.mockReturnValue({
      activeOrganizationId: "org-1",
      refreshSession,
    } as unknown as ReturnType<typeof useAuth>);

    renderPage(["/onboarding/organization"]);
    expect(screen.queryByText("Already have organizations?")).toBeNull();
    expect(screen.getByText("Shared Org")).toBeTruthy();
  });

  it("surfaces mutation errors", async () => {
    createOrganizationMutateAsync.mockRejectedValue(
      new Error("Unable to create organization")
    );

    renderPage(["/onboarding/organization"]);

    fireEvent.change(screen.getByPlaceholderText("Acme QA Team"), {
      target: { value: "Failing Org" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create organization" })
    );

    await waitFor(() =>
      expect(screen.getByText("Unable to create organization")).toBeTruthy()
    );
  });
});
