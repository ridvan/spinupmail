import { useNavigate } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Logout03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { usePopupSession } from "@/entrypoints/popup/hooks/use-popup-session";

export function SettingsPage() {
  const navigate = useNavigate();
  const {
    notificationEnabled,
    resolvedAuthState,
    signOut,
    toggleNotifications,
  } = usePopupSession();

  if (!resolvedAuthState) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-10 flex min-h-180 flex-col bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-3">
        <Button
          aria-label="Back to inbox"
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate("/inbox")}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
        </Button>
        <div className="text-sm font-medium">Settings</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          <div className="rounded-2xl border p-3">
            <div className="text-sm font-medium">Connection</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {resolvedAuthState.mode === "hosted"
                ? "Hosted SpinupMail"
                : "Custom deployment"}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {resolvedAuthState.baseUrl}
            </div>
          </div>

          <div className="rounded-2xl border p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Notifications</div>
                <div className="text-xs text-muted-foreground">
                  Poll for new inbox activity every minute.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void toggleNotifications()}
              >
                {notificationEnabled ? "On" : "Off"}
              </Button>
            </div>
          </div>

          {resolvedAuthState.bootstrap.pendingInvitations.length > 0 ? (
            <div className="rounded-2xl border p-3">
              <div className="mb-2 text-sm font-medium">
                Pending invitations
              </div>
              <div className="space-y-2">
                {resolvedAuthState.bootstrap.pendingInvitations.map(
                  invitation => (
                    <div
                      key={invitation.id}
                      className="rounded-xl border px-3 py-2"
                    >
                      <div className="text-sm font-medium">
                        {invitation.organizationName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {invitation.email}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => void signOut()}
          >
            <HugeiconsIcon icon={Logout03Icon} strokeWidth={2} />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
