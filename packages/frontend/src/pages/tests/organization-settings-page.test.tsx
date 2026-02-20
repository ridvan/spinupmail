import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationSettingsPage } from "@/pages/organization-settings-page";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useActiveOrganizationQuery,
  useCancelInvitationMutation,
  useInviteMemberMutation,
  useOrganizationInvitationsQuery,
  useOrganizationMembersQuery,
  useRemoveMemberMutation,
  useUpdateMemberRoleMutation,
  useUpdateOrganizationMutation,
} from "@/features/organization/hooks/use-organizations";
import { renderWithRouter } from "@/test/router-utils";

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/organization/hooks/use-organizations", () => ({
  useActiveOrganizationQuery: vi.fn(),
  useOrganizationMembersQuery: vi.fn(),
  useOrganizationInvitationsQuery: vi.fn(),
  useUpdateOrganizationMutation: vi.fn(),
  useInviteMemberMutation: vi.fn(),
  useCancelInvitationMutation: vi.fn(),
  useUpdateMemberRoleMutation: vi.fn(),
  useRemoveMemberMutation: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseActiveOrganizationQuery = vi.mocked(useActiveOrganizationQuery);
const mockedUseOrganizationMembersQuery = vi.mocked(
  useOrganizationMembersQuery
);
const mockedUseOrganizationInvitationsQuery = vi.mocked(
  useOrganizationInvitationsQuery
);
const mockedUseUpdateOrganizationMutation = vi.mocked(
  useUpdateOrganizationMutation
);
const mockedUseInviteMemberMutation = vi.mocked(useInviteMemberMutation);
const mockedUseCancelInvitationMutation = vi.mocked(
  useCancelInvitationMutation
);
const mockedUseUpdateMemberRoleMutation = vi.mocked(
  useUpdateMemberRoleMutation
);
const mockedUseRemoveMemberMutation = vi.mocked(useRemoveMemberMutation);

const updateOrganizationMutateAsync = vi.fn();
const inviteMemberMutateAsync = vi.fn();
const cancelInvitationMutateAsync = vi.fn();
const updateMemberRoleMutateAsync = vi.fn();
const removeMemberMutateAsync = vi.fn();

const baseActiveOrganization = {
  id: "org-1",
  name: "Acme Org",
  slug: "acme-org",
  members: [
    {
      id: "member-owner",
      role: "owner",
      user: {
        id: "user-1",
        name: "Owner",
        email: "owner@example.com",
      },
    },
    {
      id: "member-2",
      role: "member",
      user: {
        id: "user-2",
        name: "Teammate",
        email: "member@example.com",
      },
    },
  ],
  invitations: [
    {
      id: "inv-existing",
      email: "invitee@example.com",
      role: "member",
      status: "pending",
    },
  ],
};

const renderPage = () =>
  renderWithRouter({
    routes: [
      { path: "/organization/settings", element: <OrganizationSettingsPage /> },
    ],
    initialEntries: ["/organization/settings"],
  });

describe("OrganizationSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/organization/settings"
    );

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    updateOrganizationMutateAsync.mockResolvedValue({ success: true });
    inviteMemberMutateAsync.mockResolvedValue({ id: "inv-created" });
    cancelInvitationMutateAsync.mockResolvedValue({ success: true });
    updateMemberRoleMutateAsync.mockResolvedValue({ success: true });
    removeMemberMutateAsync.mockResolvedValue({ success: true });

    mockedUseAuth.mockReturnValue({
      user: {
        id: "user-1",
        name: "Owner",
        email: "owner@example.com",
      },
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseActiveOrganizationQuery.mockReturnValue({
      data: baseActiveOrganization,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useActiveOrganizationQuery>);

    mockedUseOrganizationMembersQuery.mockReturnValue({
      data: baseActiveOrganization.members,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrganizationMembersQuery>);

    mockedUseOrganizationInvitationsQuery.mockReturnValue({
      data: baseActiveOrganization.invitations,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrganizationInvitationsQuery>);

    mockedUseUpdateOrganizationMutation.mockReturnValue({
      mutateAsync: updateOrganizationMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateOrganizationMutation>);

    mockedUseInviteMemberMutation.mockReturnValue({
      mutateAsync: inviteMemberMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useInviteMemberMutation>);

    mockedUseCancelInvitationMutation.mockReturnValue({
      mutateAsync: cancelInvitationMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCancelInvitationMutation>);

    mockedUseUpdateMemberRoleMutation.mockReturnValue({
      mutateAsync: updateMemberRoleMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateMemberRoleMutation>);

    mockedUseRemoveMemberMutation.mockReturnValue({
      mutateAsync: removeMemberMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useRemoveMemberMutation>);
  });

  it("shows loading state", () => {
    mockedUseActiveOrganizationQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useActiveOrganizationQuery>);

    renderPage();

    expect(screen.getByText("Loading organization settings")).toBeTruthy();
  });

  it("shows empty state when no active organization exists", () => {
    mockedUseActiveOrganizationQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useActiveOrganizationQuery>);

    renderPage();

    expect(screen.getByText("No active organization found.")).toBeTruthy();
  });

  it("gates management actions for non-admin members", () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: "user-member",
        name: "Member",
        email: "member@example.com",
      },
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseActiveOrganizationQuery.mockReturnValue({
      data: {
        ...baseActiveOrganization,
        members: [
          {
            id: "member-current",
            role: "member",
            user: {
              id: "user-member",
              name: "Member",
              email: "member@example.com",
            },
          },
        ],
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useActiveOrganizationQuery>);

    mockedUseOrganizationMembersQuery.mockReturnValue({
      data: [
        {
          id: "member-current",
          role: "member",
          user: {
            id: "user-member",
            name: "Member",
            email: "member@example.com",
          },
        },
      ],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useOrganizationMembersQuery>);

    renderPage();

    expect(screen.getAllByText("View only").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Only organization owners and admins can create and manage invitations."
      )
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Invite" })).toBeNull();
  });

  it("creates invite link from origin and resets invite email", async () => {
    renderPage();

    const inviteEmailInput = screen.getByPlaceholderText(
      "new.member@company.com"
    );
    fireEvent.change(inviteEmailInput, {
      target: { value: "new.member@company.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() =>
      expect(inviteMemberMutateAsync).toHaveBeenCalledWith({
        email: "new.member@company.com",
        role: "member",
      })
    );

    const createdLink = `${window.location.origin}/onboarding/organization?invitationId=inv-created`;
    expect(await screen.findByText(createdLink)).toBeTruthy();
    expect((inviteEmailInput as HTMLInputElement).value).toBe("");
  });

  it("copies organization id and invitation links to clipboard", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Copy ID" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Copy link" })[0]!);

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenNthCalledWith(1, "org-1")
    );
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenNthCalledWith(
        2,
        `${window.location.origin}/onboarding/organization?invitationId=inv-existing`
      )
    );
  });

  it("updates member role and removes member", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Make admin" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(updateMemberRoleMutateAsync).toHaveBeenCalledWith({
        memberId: "member-2",
        role: "admin",
      })
    );
    await waitFor(() =>
      expect(removeMemberMutateAsync).toHaveBeenCalledWith("member-2")
    );
  });

  it("renders mutation error messages", async () => {
    inviteMemberMutateAsync.mockRejectedValue(
      new Error("Unable to invite member")
    );

    renderPage();

    fireEvent.change(screen.getByPlaceholderText("new.member@company.com"), {
      target: { value: "bad@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() =>
      expect(screen.getByText("Unable to invite member")).toBeTruthy()
    );
  });
});
