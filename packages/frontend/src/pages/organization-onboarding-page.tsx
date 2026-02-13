import * as React from "react";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useAcceptInvitationMutation,
  useCreateOrganizationMutation,
  useOrganizationInvitationQuery,
  useOrganizationsQuery,
  useSetActiveOrganizationMutation,
  useUserInvitationsQuery,
} from "@/features/organization/hooks/use-organizations";

const safeNextPath = (value: string | null) => {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
};

export const OrganizationOnboardingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeOrganizationId, refreshSession } = useAuth();

  const invitationId = searchParams.get("invitationId");
  const invitationQuery = useOrganizationInvitationQuery(invitationId);
  const userInvitationsQuery = useUserInvitationsQuery();
  const organizationsQuery = useOrganizationsQuery();
  const createOrganizationMutation = useCreateOrganizationMutation();
  const setActiveOrganizationMutation = useSetActiveOrganizationMutation();
  const acceptInvitationMutation = useAcceptInvitationMutation();

  const [organizationName, setOrganizationName] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams]
  );

  const handleComplete = async () => {
    await refreshSession();
    await navigate(nextPath, { replace: true });
  };

  const handleCreateOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    try {
      await createOrganizationMutation.mutateAsync(organizationName);
      await handleComplete();
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleAcceptInvitation = async (id: string) => {
    setErrorMessage(null);

    try {
      await acceptInvitationMutation.mutateAsync(id);
      await handleComplete();
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const isBusy =
    createOrganizationMutation.isPending ||
    acceptInvitationMutation.isPending ||
    setActiveOrganizationMutation.isPending;

  const organizations = organizationsQuery.data ?? [];

  const pendingInvitations = (userInvitationsQuery.data ?? []).filter(
    invitation => invitation.status === "pending"
  );

  const handleUseExistingOrganization = async (organizationId: string) => {
    setErrorMessage(null);

    try {
      await setActiveOrganizationMutation.mutateAsync(organizationId);
      await handleComplete();
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-8">
      <div className="grid w-full gap-5 md:grid-cols-2">
        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-xl">Create an organization</CardTitle>
            <p className="text-sm text-muted-foreground">
              Create a new organization to start generating shared mailbox
              addresses.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <form className="space-y-3" onSubmit={handleCreateOrganization}>
              <Input
                value={organizationName}
                onChange={event => setOrganizationName(event.target.value)}
                placeholder="Acme QA Team"
                minLength={2}
                required
              />
              <Button className="w-full" disabled={isBusy} type="submit">
                {createOrganizationMutation.isPending
                  ? "Creating..."
                  : "Create organization"}
              </Button>
            </form>

            {!activeOrganizationId && organizations.length > 0 ? (
              <div className="space-y-2 rounded-md border border-border/70 p-3">
                <p className="text-xs text-muted-foreground">
                  Already have organizations?
                </p>
                {organizations.map(organization => (
                  <div
                    className="flex items-center justify-between gap-2"
                    key={organization.id}
                  >
                    <p className="truncate text-sm font-medium">
                      {organization.name}
                    </p>
                    <Button
                      disabled={isBusy}
                      onClick={() =>
                        void handleUseExistingOrganization(organization.id)
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Use
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle className="text-xl">Join an organization</CardTitle>
            <p className="text-sm text-muted-foreground">
              Join using an invitation link. Pending invitations for your email
              are listed below.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitationId ? (
              invitationQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading invitation...
                </p>
              ) : invitationQuery.error ? (
                <p className="text-sm text-destructive">
                  {invitationQuery.error.message}
                </p>
              ) : invitationQuery.data ? (
                <div className="space-y-2 rounded-md border border-border/70 p-3">
                  <p className="text-sm font-medium">
                    {invitationQuery.data.organizationName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Invited by {invitationQuery.data.inviterEmail}
                  </p>
                  <Button
                    className="w-full"
                    disabled={isBusy}
                    onClick={() =>
                      void handleAcceptInvitation(invitationQuery.data!.id)
                    }
                    type="button"
                  >
                    Accept invite
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Invitation not found.
                </p>
              )
            ) : null}

            {userInvitationsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Checking pending invitations...
              </p>
            ) : pendingInvitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pending invitations.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingInvitations.map(invitation => (
                  <div
                    className="flex items-center justify-between rounded-md border border-border/70 p-3"
                    key={invitation.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {invitation.organizationName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Role: {invitation.role}
                      </p>
                    </div>
                    <Button
                      disabled={isBusy}
                      onClick={() => void handleAcceptInvitation(invitation.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Join
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {errorMessage ? (
        <p className="fixed right-4 bottom-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};
