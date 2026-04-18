import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { persistAuthState } from "@/lib/auth";
import { extensionApi } from "@/lib/api";
import { buildAuthState, getResolvedOrganizationId } from "@/lib/auth-state";
import {
  activeOrganizationIdItem,
  authStateItem,
  focusIntentItem,
  notificationSettingsItem,
  pollStateItem,
  selectedAddressIdsItem,
} from "@/lib/storage";
import { sendRuntimeMessage } from "@/lib/runtime";
import type { AuthState } from "@/lib/types";
import { queryKeys } from "@/entrypoints/popup/lib/query-keys";
import { useStorageItem } from "@/entrypoints/popup/hooks/use-storage-item";
import {
  PopupSessionContext,
  type PopupSessionValue,
} from "@/entrypoints/popup/hooks/use-popup-session";

export function PopupSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [authState] = useStorageItem(authStateItem);
  const [activeOrganizationId, setActiveOrganizationId] = useStorageItem(
    activeOrganizationIdItem
  );
  const [selectedAddressIds, setSelectedAddressIds] = useStorageItem(
    selectedAddressIdsItem
  );
  const [notificationSettings, setNotificationSettings] = useStorageItem(
    notificationSettingsItem
  );
  const [pollState, setPollState] = useStorageItem(pollStateItem);
  const [focusIntent, setFocusIntent] = useStorageItem(focusIntentItem);
  const [focusedEmailId, setFocusedEmailId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    void sendRuntimeMessage({
      type: "popup:opened",
    });
  }, []);

  const bootstrapQuery = useQuery({
    enabled: Boolean(authState),
    queryKey: queryKeys.bootstrap(
      authState ? `${authState.baseUrl}:${authState.apiKey}` : null
    ),
    queryFn: async () => {
      if (!authState) {
        return null;
      }

      const bootstrap = await extensionApi.bootstrap(authState);
      const nextState = buildAuthState({
        apiKey: authState.apiKey,
        baseUrl: authState.baseUrl,
        bootstrap,
        mode: authState.mode,
      });
      await persistAuthState(nextState);
      return nextState;
    },
    placeholderData: authState,
  });

  const resolvedAuthState = bootstrapQuery.isPlaceholderData
    ? null
    : (bootstrapQuery.data ?? null);
  const resolvedOrganizationId =
    resolvedAuthState && activeOrganizationId !== null
      ? getResolvedOrganizationId({
          activeOrganizationId,
          bootstrap: resolvedAuthState.bootstrap,
        })
      : resolvedAuthState
        ? getResolvedOrganizationId({
            activeOrganizationId: null,
            bootstrap: resolvedAuthState.bootstrap,
          })
        : null;

  React.useEffect(() => {
    if (!focusIntent || !resolvedAuthState) {
      return;
    }

    void setActiveOrganizationId(focusIntent.organizationId);
    void setSelectedAddressIds(previousSelectedAddressIds => ({
      ...(previousSelectedAddressIds ?? {}),
      [focusIntent.organizationId]: focusIntent.addressId,
    }));
    setFocusedEmailId(focusIntent.emailId);
    void setFocusIntent(null);
  }, [
    focusIntent,
    resolvedAuthState,
    setActiveOrganizationId,
    setFocusIntent,
    setSelectedAddressIds,
  ]);

  const persistConnectedState = React.useEffectEvent(
    async (nextState: AuthState) => {
      await persistAuthState(nextState);
    }
  );

  const persistBootstrappedState = React.useEffectEvent(
    async (nextState: AuthState) => {
      await persistAuthState(nextState);
    }
  );

  const setSelectedAddressForOrganization = React.useEffectEvent(
    async (organizationId: string, addressId: string) => {
      await setSelectedAddressIds(previousSelectedAddressIds => ({
        ...(previousSelectedAddressIds ?? {}),
        [organizationId]: addressId,
      }));
    }
  );

  const markEmailSeen = React.useEffectEvent(async (emailId: string) => {
    if (!pollState) {
      return;
    }

    await setPollState(previousPollState => {
      const currentPollState = previousPollState ?? pollState;

      if (currentPollState.seenEmailIds.includes(emailId)) {
        return currentPollState;
      }

      return {
        ...currentPollState,
        seenEmailIds: [...currentPollState.seenEmailIds, emailId].slice(-500),
      };
    });
  });

  const signOut = React.useEffectEvent(async () => {
    const result = await sendRuntimeMessage({
      type: "auth:sign-out",
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    queryClient.clear();
    setFocusedEmailId(null);
  });

  const toggleNotifications = React.useEffectEvent(async () => {
    if (!notificationSettings) {
      return;
    }

    await setNotificationSettings({
      enabled: !notificationSettings.enabled,
    });
  });

  const clearFocusedEmailId = React.useEffectEvent(() => {
    setFocusedEmailId(null);
  });

  const value: PopupSessionValue = {
    activeOrganizationId,
    clearFocusedEmailId,
    focusedEmailId,
    markEmailSeen,
    notificationEnabled: notificationSettings?.enabled ?? true,
    persistBootstrappedState,
    persistConnectedState,
    resolvedAuthState,
    resolvedOrganizationId,
    seenEmailIds: pollState?.seenEmailIds ?? [],
    selectedAddressIds: selectedAddressIds ?? {},
    setActiveOrganizationId,
    setSelectedAddressForOrganization,
    signOut,
    toggleNotifications,
  };

  return (
    <PopupSessionContext.Provider value={value}>
      {children}
    </PopupSessionContext.Provider>
  );
}
