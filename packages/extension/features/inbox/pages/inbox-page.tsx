import * as React from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon,
  NotificationIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { extensionApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { usePopupSession } from "@/entrypoints/popup/hooks/use-popup-session";
import { queryKeys } from "@/entrypoints/popup/lib/query-keys";
import { AddressSwitcher } from "@/features/inbox/components/address-switcher";
import { CreateAddressDialog } from "@/features/inbox/components/create-address-dialog";
import { EmailDetailView } from "@/features/inbox/components/email-detail-view";
import { EmailList } from "@/features/inbox/components/email-list";
import { OrganizationSwitcher } from "@/features/inbox/components/organization-switcher";

export function InboxPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    activeOrganizationId,
    clearFocusedEmailId,
    focusedEmailId,
    markEmailSeen,
    notificationEnabled,
    resolvedAuthState,
    resolvedOrganizationId,
    seenEmailIds,
    selectedAddressIds,
    setActiveOrganizationId,
    setSelectedAddressForOrganization,
    toggleNotifications,
  } = usePopupSession();

  const addressActivityQuery = useQuery({
    enabled: Boolean(resolvedAuthState && resolvedOrganizationId),
    queryKey: queryKeys.addressActivity(resolvedOrganizationId),
    queryFn: async () => {
      return extensionApi.listRecentAddressActivity(
        resolvedAuthState!,
        resolvedOrganizationId!
      );
    },
  });

  const addresses = addressActivityQuery.data?.items ?? [];
  const selectedAddressId =
    (resolvedOrganizationId
      ? selectedAddressIds[resolvedOrganizationId]
      : null) ??
    addresses[0]?.id ??
    null;
  const previousSelectedAddressIdRef = React.useRef<string | null>(
    selectedAddressId
  );
  const [selectedEmailState, setSelectedEmailState] = React.useState<{
    addressId: string | null;
    emailId: string | null;
  }>(() => ({
    addressId: selectedAddressId,
    emailId: focusedEmailId,
  }));
  const selectedEmailId =
    focusedEmailId ??
    (selectedEmailState.addressId === null ||
    selectedEmailState.addressId === selectedAddressId
      ? selectedEmailState.emailId
      : null);

  React.useEffect(() => {
    setSelectedEmailState(currentState => {
      const previousSelectedAddressId = previousSelectedAddressIdRef.current;
      const shouldSyncAddressId =
        currentState.addressId === null ||
        currentState.addressId === previousSelectedAddressId;

      if (
        !shouldSyncAddressId ||
        currentState.addressId === selectedAddressId
      ) {
        return currentState;
      }

      return {
        ...currentState,
        addressId: selectedAddressId,
      };
    });

    previousSelectedAddressIdRef.current = selectedAddressId;
  }, [selectedAddressId]);

  React.useEffect(() => {
    if (!resolvedOrganizationId || !selectedAddressId) {
      return;
    }

    if (selectedAddressIds[resolvedOrganizationId] === selectedAddressId) {
      return;
    }

    void setSelectedAddressForOrganization(
      resolvedOrganizationId,
      selectedAddressId
    );
  }, [
    resolvedOrganizationId,
    selectedAddressId,
    selectedAddressIds,
    setSelectedAddressForOrganization,
  ]);

  const emailsQuery = useQuery({
    enabled: Boolean(
      resolvedAuthState && resolvedOrganizationId && selectedAddressId
    ),
    queryKey: queryKeys.emails(resolvedOrganizationId, selectedAddressId),
    queryFn: () =>
      extensionApi.listEmails(resolvedAuthState!, {
        addressId: selectedAddressId!,
        organizationId: resolvedOrganizationId!,
      }),
  });

  if (!resolvedAuthState || !resolvedOrganizationId) {
    return null;
  }

  return (
    <div className="surface-subtle relative flex min-h-180 flex-col bg-background">
      <header className="flex items-center gap-2 border-b bg-background/92 px-3 py-3 backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          <OrganizationSwitcher
            activeOrganizationId={activeOrganizationId}
            organizations={resolvedAuthState.bootstrap.organizations}
            onChange={value => void setActiveOrganizationId(value)}
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            notificationEnabled
              ? "Disable notifications"
              : "Enable notifications"
          }
          onClick={() => void toggleNotifications()}
        >
          <HugeiconsIcon
            icon={NotificationIcon}
            strokeWidth={2}
            className={cn(
              notificationEnabled ? "text-foreground" : "text-muted-foreground"
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Settings"
          onClick={() => navigate("/settings")}
        >
          <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
        </Button>
      </header>

      <div className="flex items-center gap-2 border-b px-3 py-3">
        <AddressSwitcher
          addresses={addresses}
          selectedAddressId={selectedAddressId}
          onChange={value => {
            if (focusedEmailId) {
              clearFocusedEmailId();
            }

            setSelectedEmailState({
              addressId: value,
              emailId: null,
            });

            void setSelectedAddressForOrganization(
              resolvedOrganizationId,
              value
            );
          }}
        />
        <CreateAddressDialog
          authState={resolvedAuthState}
          organizationId={resolvedOrganizationId}
          onCreated={async addressId => {
            await queryClient.invalidateQueries({
              queryKey: queryKeys.addressActivity(resolvedOrganizationId),
            });
            await setSelectedAddressForOrganization(
              resolvedOrganizationId,
              addressId
            );

            if (focusedEmailId) {
              clearFocusedEmailId();
            }

            setSelectedEmailState({
              addressId,
              emailId: null,
            });
          }}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Mail01Icon}
              strokeWidth={2}
              className="text-muted-foreground size-4"
            />
            <div className="text-sm font-medium">Inbox</div>
          </div>
          {emailsQuery.data?.items.length ? (
            <Badge variant="outline">{emailsQuery.data.items.length}</Badge>
          ) : null}
        </div>
        <Separator />

        {emailsQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading inbox...
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <EmailList
              emails={emailsQuery.data?.items ?? []}
              seenEmailIds={seenEmailIds}
              selectedEmailId={selectedEmailId}
              onSelect={emailId => {
                if (focusedEmailId) {
                  clearFocusedEmailId();
                }

                setSelectedEmailState({
                  addressId: selectedAddressId,
                  emailId,
                });
              }}
            />
          </div>
        )}
      </div>

      {selectedEmailId ? (
        <EmailDetailView
          authState={resolvedAuthState}
          emailId={selectedEmailId}
          organizationId={resolvedOrganizationId}
          onBack={() => {
            if (focusedEmailId) {
              clearFocusedEmailId();
            }

            setSelectedEmailState({
              addressId: selectedAddressId,
              emailId: null,
            });
          }}
          onSeen={markEmailSeen}
        />
      ) : null}
    </div>
  );
}
