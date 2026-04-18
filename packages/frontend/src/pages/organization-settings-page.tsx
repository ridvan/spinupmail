import * as React from "react";
import { toast } from "sonner";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  OrganizationInvitationsCard,
  OrganizationMembersCard,
  OrganizationProfileCard,
} from "@/features/organization/components/organization-settings";
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

const buildInvitationUrl = (invitationId: string) => {
  const base = window.location.origin;
  return `${base}/onboarding/organization?invitationId=${encodeURIComponent(invitationId)}`;
};

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export const OrganizationSettingsPage = () => {
  const { user } = useAuth();
  const activeOrganizationQuery = useActiveOrganizationQuery();
  const activeOrganization = activeOrganizationQuery.data;
  const activeOrganizationMembers = activeOrganization?.members ?? [];
  const currentMember = activeOrganizationMembers.find(
    member => member.user.id === user?.id
  );
  const canManage =
    currentMember?.role === "owner" || currentMember?.role === "admin";

  const membersQuery = useOrganizationMembersQuery(Boolean(activeOrganization));
  const invitationsQuery = useOrganizationInvitationsQuery(canManage);

  const updateOrganizationMutation = useUpdateOrganizationMutation();
  const inviteMemberMutation = useInviteMemberMutation();
  const cancelInvitationMutation = useCancelInvitationMutation();
  const updateMemberRoleMutation = useUpdateMemberRoleMutation();
  const removeMemberMutation = useRemoveMemberMutation();

  const [organizationNameDraft, setOrganizationNameDraft] = React.useState<{
    organizationId: string | null;
    value: string;
  } | null>(null);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"member" | "admin">(
    "member"
  );
  const [createdInviteLink, setCreatedInviteLink] = React.useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const members = membersQuery.data ?? activeOrganizationMembers;
  const invitations = canManage
    ? (invitationsQuery.data ?? activeOrganization?.invitations ?? [])
    : [];
  const activeOrganizationId = activeOrganization?.id ?? null;
  const organizationName =
    organizationNameDraft?.organizationId === activeOrganizationId
      ? organizationNameDraft.value
      : (activeOrganization?.name ?? "");

  const handleError = (error: unknown, fallback: string) => {
    const message = toErrorMessage(error, fallback);
    setErrorMessage(message);
    toast.error(message);
  };

  const handleOrganizationNameChange = (value: string) => {
    setOrganizationNameDraft({
      organizationId: activeOrganizationId,
      value,
    });
  };

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const handleRenameOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    setErrorMessage(null);

    try {
      await updateOrganizationMutation.mutateAsync(organizationName.trim());
      toast.success("Organization name updated.");
    } catch (error) {
      handleError(error, "Unable to update organization name");
    }
  };

  const handleInviteMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    setErrorMessage(null);
    setCreatedInviteLink(null);

    try {
      const invitation = await inviteMemberMutation.mutateAsync({
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      if (invitation?.id) {
        setCreatedInviteLink(buildInvitationUrl(invitation.id));
      }
      setInviteEmail("");
      setInviteRole("member");
      toast.success("Invitation sent.");
    } catch (error) {
      handleError(error, "Unable to invite member");
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    if (!canManage) return;
    setErrorMessage(null);

    try {
      await cancelInvitationMutation.mutateAsync(invitationId);
      toast.success("Invitation canceled.");
    } catch (error) {
      handleError(error, "Unable to cancel invitation");
    }
  };

  const handleToggleAdmin = async (memberId: string, role: string) => {
    if (!canManage) return;
    setErrorMessage(null);

    if (role !== "member" && role !== "admin") return;

    try {
      await updateMemberRoleMutation.mutateAsync({
        memberId,
        role: role === "member" ? "admin" : "member",
      });
      toast.success(
        role === "member"
          ? "Member promoted to admin."
          : "Admin changed to member."
      );
    } catch (error) {
      handleError(error, "Unable to update member role");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!canManage) return;
    setErrorMessage(null);

    try {
      await removeMemberMutation.mutateAsync(memberId);
      toast.success("Member removed.");
    } catch (error) {
      handleError(error, "Unable to remove member");
    }
  };

  const isProfileLoading = activeOrganizationQuery.isLoading;
  const isMembersLoading =
    isProfileLoading || (Boolean(activeOrganization) && membersQuery.isLoading);
  const isInvitationsLoading =
    isProfileLoading ||
    (Boolean(activeOrganization) && canManage && invitationsQuery.isLoading);

  if (!activeOrganization && !isProfileLoading) {
    return (
      <Card className="border-border/70 bg-card/60">
        <CardHeader className="space-y-1 border-b border-border/70 pb-4">
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>No active organization found.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const organizationNameChanged =
    activeOrganization != null &&
    organizationName.trim() !== activeOrganization.name.trim();
  const pendingInvitationsCount = invitations.filter(
    invitation => invitation.status === "pending"
  ).length;
  const currentUserRole = currentMember?.role ?? "member";

  return (
    <div className="space-y-6 [&_button]:cursor-pointer">
      <section
        id="organization-profile"
        className="scroll-mt-24 md:scroll-mt-28"
        aria-label="Organization profile"
      >
        <OrganizationProfileCard
          activeOrganization={activeOrganization ?? null}
          isLoading={isProfileLoading}
          canManage={canManage}
          membersCount={members.length}
          pendingInvitationsCount={pendingInvitationsCount}
          currentUserRole={currentUserRole}
          organizationName={organizationName}
          organizationNameChanged={organizationNameChanged}
          isRenamePending={updateOrganizationMutation.isPending}
          onOrganizationNameChange={handleOrganizationNameChange}
          onRenameOrganization={handleRenameOrganization}
          onCopyOrganizationId={() =>
            activeOrganization
              ? void copyToClipboard(
                  activeOrganization.id,
                  "Organization ID copied."
                )
              : undefined
          }
        />
      </section>

      <section
        id="organization-members"
        className="scroll-mt-24 md:scroll-mt-28"
        aria-label="Organization members"
      >
        <OrganizationMembersCard
          members={members}
          isLoading={isMembersLoading}
          currentUserId={user?.id}
          currentUserRole={currentUserRole}
          canManage={canManage}
          isUpdateRolePending={updateMemberRoleMutation.isPending}
          isRemoveMemberPending={removeMemberMutation.isPending}
          onToggleAdmin={(memberId, role) =>
            void handleToggleAdmin(memberId, role)
          }
          onRemoveMember={memberId => void handleRemoveMember(memberId)}
        />
      </section>

      <section
        id="organization-invitations"
        className="scroll-mt-24 md:scroll-mt-28"
        aria-label="Organization invitations"
      >
        <OrganizationInvitationsCard
          canManage={canManage}
          isLoading={isInvitationsLoading}
          pendingInvitationsCount={pendingInvitationsCount}
          inviteEmail={inviteEmail}
          inviteRole={inviteRole}
          createdInviteLink={createdInviteLink}
          invitations={invitations}
          isInviteMemberPending={inviteMemberMutation.isPending}
          isCancelInvitationPending={cancelInvitationMutation.isPending}
          onInviteEmailChange={setInviteEmail}
          onInviteRoleChange={setInviteRole}
          onInviteMember={handleInviteMember}
          onCopyCreatedInviteLink={() => {
            if (!createdInviteLink) return;
            void copyToClipboard(createdInviteLink, "Invitation link copied.");
          }}
          onCopyInvitationLink={invitationId =>
            void copyToClipboard(
              buildInvitationUrl(invitationId),
              "Invitation link copied."
            )
          }
          onCancelInvite={invitationId => void handleCancelInvite(invitationId)}
        />
      </section>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};
