import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extensionApi } from "@/lib/api";
import { buildAuthState } from "@/lib/auth-state";
import type { ExtensionInvitation } from "@spinupmail/contracts";
import { toErrorMessage } from "@/lib/utils";
import { usePopupSession } from "@/entrypoints/popup/hooks/use-popup-session";

export function OnboardingPage() {
  const { persistBootstrappedState, resolvedAuthState } = usePopupSession();
  const [organizationName, setOrganizationName] = React.useState("");

  const createOrganizationMutation = useMutation({
    mutationFn: async () => {
      if (!resolvedAuthState) {
        throw new Error("Authentication state is unavailable");
      }

      if (!organizationName.trim()) {
        throw new Error("Organization name is required");
      }

      await extensionApi.createOrganization(
        resolvedAuthState,
        organizationName.trim()
      );
      const bootstrap = await extensionApi.bootstrap(resolvedAuthState);
      const nextState = buildAuthState({
        apiKey: resolvedAuthState.apiKey,
        baseUrl: resolvedAuthState.baseUrl,
        bootstrap,
        mode: resolvedAuthState.mode,
      });
      await persistBootstrappedState(nextState);
      return bootstrap;
    },
    onError: error => toast.error(toErrorMessage(error)),
    onSuccess: () => {
      toast.success("Workspace created");
      setOrganizationName("");
    },
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitation: ExtensionInvitation) => {
      if (!resolvedAuthState) {
        throw new Error("Authentication state is unavailable");
      }

      const bootstrap = await extensionApi.acceptInvitation(
        resolvedAuthState,
        invitation.id
      );
      const nextState = buildAuthState({
        apiKey: resolvedAuthState.apiKey,
        baseUrl: resolvedAuthState.baseUrl,
        bootstrap,
        mode: resolvedAuthState.mode,
      });
      await persistBootstrappedState(nextState);
      return bootstrap;
    },
    onError: error => toast.error(toErrorMessage(error)),
    onSuccess: () => toast.success("Invitation accepted"),
  });

  if (!resolvedAuthState) {
    return null;
  }

  return (
    <div className="surface-subtle flex min-h-180 flex-col gap-5 overflow-y-auto px-5 py-5">
      <div className="space-y-2">
        <Badge variant="outline">Workspace setup</Badge>
        <h1 className="text-[1.4rem] leading-tight font-medium tracking-tight">
          You're signed in. Now give the extension a workspace to live in.
        </h1>
      </div>

      <div className="rounded-2xl border bg-background/90 p-3 shadow-sm">
        <div className="mb-3 space-y-1">
          <div className="font-medium">Create a workspace</div>
          <div className="text-muted-foreground text-sm">
            One calm inbox surface per organization. That's the whole idea.
          </div>
        </div>
        <div className="space-y-2">
          <Input
            value={organizationName}
            onChange={event => setOrganizationName(event.currentTarget.value)}
            placeholder="Acme QA"
          />
          <Button
            className="w-full"
            disabled={
              !organizationName.trim() || createOrganizationMutation.isPending
            }
            onClick={() => void createOrganizationMutation.mutateAsync()}
          >
            {createOrganizationMutation.isPending
              ? "Creating..."
              : "Create workspace"}
          </Button>
        </div>
      </div>

      {resolvedAuthState.bootstrap.pendingInvitations.length > 0 ? (
        <div className="rounded-2xl border bg-background/90 p-3 shadow-sm">
          <div className="mb-3 space-y-1">
            <div className="font-medium">Pending invitations</div>
            <div className="text-muted-foreground text-sm">
              Accept one and the inbox is ready immediately.
            </div>
          </div>
          <div className="hairline-list">
            {resolvedAuthState.bootstrap.pendingInvitations.map(invitation => (
              <div
                key={invitation.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {invitation.organizationName}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">
                    Invited as {invitation.email}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acceptInvitationMutation.isPending}
                  onClick={() =>
                    void acceptInvitationMutation.mutateAsync(invitation)
                  }
                >
                  Accept
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
