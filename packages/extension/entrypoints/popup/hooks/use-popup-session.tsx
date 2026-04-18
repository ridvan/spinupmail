import * as React from "react";
import type { AuthState } from "@/lib/types";

export type PopupSessionValue = {
  activeOrganizationId: string | null;
  clearFocusedEmailId: () => void;
  focusedEmailId: string | null;
  markEmailSeen: (emailId: string) => Promise<void>;
  notificationEnabled: boolean;
  persistBootstrappedState: (nextState: AuthState) => Promise<void>;
  persistConnectedState: (nextState: AuthState) => Promise<void>;
  resolvedAuthState: AuthState | null;
  resolvedOrganizationId: string | null;
  seenEmailIds: string[];
  selectedAddressIds: Record<string, string>;
  setActiveOrganizationId: (organizationId: string | null) => Promise<void>;
  setSelectedAddressForOrganization: (
    organizationId: string,
    addressId: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  toggleNotifications: () => Promise<void>;
};

export const PopupSessionContext =
  React.createContext<PopupSessionValue | null>(null);

export function usePopupSession() {
  const context = React.useContext(PopupSessionContext);

  if (!context) {
    throw new Error("usePopupSession must be used inside PopupSessionProvider");
  }

  return context;
}
