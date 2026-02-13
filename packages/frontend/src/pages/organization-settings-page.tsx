import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const [organizationName, setOrganizationName] = React.useState("");
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

  React.useEffect(() => {
    if (activeOrganization?.name) {
      setOrganizationName(activeOrganization.name);
    }
  }, [activeOrganization?.name]);

  const handleError = (error: unknown) => {
    setErrorMessage((error as Error).message);
  };

  const handleRenameOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    setErrorMessage(null);

    try {
      await updateOrganizationMutation.mutateAsync(organizationName);
    } catch (error) {
      handleError(error);
    }
  };

  const handleInviteMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    setErrorMessage(null);
    setCreatedInviteLink(null);

    try {
      const invitation = await inviteMemberMutation.mutateAsync({
        email: inviteEmail,
        role: inviteRole,
      });
      if (invitation?.id) {
        setCreatedInviteLink(buildInvitationUrl(invitation.id));
      }
      setInviteEmail("");
      setInviteRole("member");
    } catch (error) {
      handleError(error);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    if (!canManage) return;
    setErrorMessage(null);

    try {
      await cancelInvitationMutation.mutateAsync(invitationId);
    } catch (error) {
      handleError(error);
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
    } catch (error) {
      handleError(error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!canManage) return;
    setErrorMessage(null);

    try {
      await removeMemberMutation.mutateAsync(memberId);
    } catch (error) {
      handleError(error);
    }
  };

  const isLoading =
    activeOrganizationQuery.isLoading ||
    membersQuery.isLoading ||
    (canManage && invitationsQuery.isLoading);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Organization Settings
        </h1>
        <p className="text-sm text-muted-foreground">Loading organization...</p>
      </div>
    );
  }

  if (!activeOrganization) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Organization Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          No active organization found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/60">
        <CardHeader>
          <CardTitle className="text-lg">Organization Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Organization ID</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={activeOrganization.id}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void navigator.clipboard.writeText(activeOrganization.id)
                }
              >
                Copy ID
              </Button>
            </div>
          </div>

          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={handleRenameOrganization}
          >
            <Input
              value={organizationName}
              onChange={event => setOrganizationName(event.target.value)}
              minLength={2}
              disabled={!canManage}
              required
            />
            <Button
              disabled={!canManage || updateOrganizationMutation.isPending}
              type="submit"
            >
              {updateOrganizationMutation.isPending ? "Saving..." : "Save name"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60">
        <CardHeader>
          <CardTitle className="text-lg">Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map(member => {
                const isCurrentUser = member.user.id === user?.id;
                const isOwner = member.role === "owner";

                return (
                  <TableRow key={member.id}>
                    <TableCell>{member.user.name}</TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell className="capitalize">{member.role}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      {canManage && !isOwner ? (
                        <Button
                          disabled={updateMemberRoleMutation.isPending}
                          onClick={() =>
                            void handleToggleAdmin(member.id, member.role)
                          }
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {member.role === "member"
                            ? "Make admin"
                            : "Make member"}
                        </Button>
                      ) : null}
                      {canManage && !isCurrentUser ? (
                        <Button
                          disabled={removeMemberMutation.isPending}
                          onClick={() => void handleRemoveMember(member.id)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Remove
                        </Button>
                      ) : null}
                      {!canManage ? (
                        <span className="text-xs text-muted-foreground">
                          View only
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60">
        <CardHeader>
          <CardTitle className="text-lg">Invitations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManage ? (
            <p className="text-sm text-muted-foreground">
              Only organization owners and admins can create and manage
              invitations.
            </p>
          ) : (
            <form
              className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
              onSubmit={handleInviteMember}
            >
              <Input
                value={inviteEmail}
                onChange={event => setInviteEmail(event.target.value)}
                placeholder="new.member@company.com"
                type="email"
                required
              />
              <Select
                value={inviteRole}
                onValueChange={value => {
                  if (value === "member" || value === "admin") {
                    setInviteRole(value);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button disabled={inviteMemberMutation.isPending} type="submit">
                {inviteMemberMutation.isPending ? "Inviting..." : "Invite"}
              </Button>
            </form>
          )}

          {canManage && createdInviteLink ? (
            <div className="rounded-md border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">Share this link</p>
              <p className="break-all font-mono text-xs">{createdInviteLink}</p>
              <Button
                className="mt-2"
                onClick={() =>
                  void navigator.clipboard.writeText(createdInviteLink)
                }
                size="sm"
                type="button"
                variant="outline"
              >
                Copy link
              </Button>
            </div>
          ) : null}

          {canManage && invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pending invitations.
            </p>
          ) : null}

          {canManage && invitations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map(invitation => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell className="capitalize">
                      {invitation.role}
                    </TableCell>
                    <TableCell className="capitalize">
                      {invitation.status}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            buildInvitationUrl(invitation.id)
                          )
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Copy link
                      </Button>
                      {invitation.status === "pending" ? (
                        <Button
                          disabled={cancelInvitationMutation.isPending}
                          onClick={() => void handleCancelInvite(invitation.id)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
};
