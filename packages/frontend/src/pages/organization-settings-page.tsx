import * as React from "react";
import {
  ConnectIcon,
  Mail01Icon,
  Settings02Icon,
  UserMultiple02Icon,
} from "@/lib/hugeicons";
import { toast } from "sonner";
import { HashTabsPage } from "@/components/layout/hash-tabs-page";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  OrganizationInvitationsCard,
  OrganizationIntegrationsCard,
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
import {
  useCreateIntegrationMutation,
  useDeleteIntegrationMutation,
  useIntegrationsQuery,
  useReplayIntegrationDispatchMutation,
  useValidateIntegrationMutation,
} from "@/features/organization/hooks/use-integrations";

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
  const integrationsQuery = useIntegrationsQuery(Boolean(activeOrganization));
  const validateIntegrationMutation = useValidateIntegrationMutation();
  const createIntegrationMutation = useCreateIntegrationMutation();
  const deleteIntegrationMutation = useDeleteIntegrationMutation();
  const replayIntegrationDispatchMutation =
    useReplayIntegrationDispatchMutation();

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const members = membersQuery.data ?? activeOrganizationMembers;
  const invitations = canManage
    ? (invitationsQuery.data ?? activeOrganization?.invitations ?? []).filter(
        inv => inv.status !== "canceled"
      )
    : [];

  const handleError = (error: unknown, fallback: string) => {
    const message = toErrorMessage(error, fallback);
    setErrorMessage(message);
    toast.error(message);
  };

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const handleRenameOrganization = async (organizationName: string) => {
    if (!canManage) return;
    setErrorMessage(null);

    try {
      await updateOrganizationMutation.mutateAsync(organizationName.trim());
      toast.success("Organization name updated.");
    } catch (error) {
      handleError(error, "Unable to update organization name");
      throw error;
    }
  };

  const handleInviteMember = async ({
    email,
    role,
  }: {
    email: string;
    role: "member" | "admin";
  }) => {
    if (!canManage) return null;
    setErrorMessage(null);

    try {
      const invitation = await inviteMemberMutation.mutateAsync({
        email: email.trim(),
        role,
      });
      toast.success("Invitation sent.");
      return invitation?.id ? buildInvitationUrl(invitation.id) : null;
    } catch (error) {
      handleError(error, "Unable to invite member");
      throw error;
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
      <Card className="rounded-lg border-border/70 bg-card/60">
        <CardHeader className="space-y-1 border-b border-border/70 pb-4">
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>No active organization found.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pendingInvitationsCount = invitations.filter(
    invitation => invitation.status === "pending"
  ).length;
  const currentUserRole = currentMember?.role ?? "member";
  const organizationSections = [
    {
      id: "organization-profile",
      label: "Profile",
      icon: Settings02Icon,
      content: (
        <OrganizationProfileCard
          key={activeOrganization?.id ?? "organization-profile"}
          activeOrganization={activeOrganization ?? null}
          isLoading={isProfileLoading}
          canManage={canManage}
          membersCount={members.length}
          pendingInvitationsCount={pendingInvitationsCount}
          currentUserRole={currentUserRole}
          isRenamePending={updateOrganizationMutation.isPending}
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
      ),
    },
    {
      id: "organization-members",
      label: "Members",
      icon: UserMultiple02Icon,
      content: (
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
      ),
    },
    {
      id: "organization-invitations",
      label: "Invitations",
      icon: Mail01Icon,
      content: (
        <OrganizationInvitationsCard
          key={activeOrganization?.id ?? "organization-invitations"}
          canManage={canManage}
          isLoading={isInvitationsLoading}
          pendingInvitationsCount={pendingInvitationsCount}
          invitations={invitations}
          isInviteMemberPending={inviteMemberMutation.isPending}
          isCancelInvitationPending={cancelInvitationMutation.isPending}
          onInviteMember={handleInviteMember}
          onCopyCreatedInviteLink={value =>
            void copyToClipboard(value, "Invitation link copied.")
          }
          onCopyInvitationLink={invitationId =>
            void copyToClipboard(
              buildInvitationUrl(invitationId),
              "Invitation link copied."
            )
          }
          onCancelInvite={invitationId => void handleCancelInvite(invitationId)}
        />
      ),
    },
    {
      id: "organization-integrations",
      label: "Integrations",
      icon: ConnectIcon,
      content: (
        <OrganizationIntegrationsCard
          canManage={canManage}
          integrations={integrationsQuery.data ?? undefined}
          isLoading={integrationsQuery.isLoading}
          validationError={
            validateIntegrationMutation.error instanceof Error
              ? validateIntegrationMutation.error.message
              : null
          }
          createError={
            createIntegrationMutation.error instanceof Error
              ? createIntegrationMutation.error.message
              : (integrationsQuery.error?.message ?? null)
          }
          isValidating={validateIntegrationMutation.isPending}
          isCreating={createIntegrationMutation.isPending}
          isArchiving={deleteIntegrationMutation.isPending}
          onValidate={payload =>
            validateIntegrationMutation.mutateAsync(payload)
          }
          onCreate={payload =>
            createIntegrationMutation.mutateAsync(payload).then(() => undefined)
          }
          onDelete={integrationId =>
            deleteIntegrationMutation.mutateAsync(integrationId)
          }
          onReplayDispatch={({ integrationId, dispatchId }) =>
            replayIntegrationDispatchMutation.mutateAsync({
              integrationId,
              dispatchId,
            })
          }
        />
      ),
    },
  ] as const;

  return (
    <div className="space-y-4">
      <HashTabsPage
        ariaLabel="Organization sections"
        className="max-w-3xl"
        defaultSection="organization-profile"
        sections={organizationSections.map(section => ({
          ...section,
          content: (
            <section aria-label={section.label}>{section.content}</section>
          ),
        }))}
      />

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};
