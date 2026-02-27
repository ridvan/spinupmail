/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  clearLastActiveOrganizationId,
  setLastActiveOrganizationId,
} from "@/features/organization/utils/active-organization-storage";
import { authClient, type AuthSession, type AuthUser } from "@/lib/auth";

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  activeOrganizationId: string | null;
  isAuthenticated: boolean;
  hasActiveOrganization: boolean;
  isSigningOut: boolean;
  isOrganizationSwitching: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  refreshSession: () => Promise<void>;
  beginOrganizationSwitch: (organizationId: string) => void;
  completeOrganizationSwitch: () => void;
  cancelOrganizationSwitch: (organizationId: string | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { data, isPending, isRefetching, refetch } = authClient.useSession();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [isOrganizationSwitching, setIsOrganizationSwitching] =
    React.useState(false);
  const [pendingOrganizationId, setPendingOrganizationId] = React.useState<
    string | null
  >(null);
  const sessionActiveOrganizationId =
    (data?.session as { activeOrganizationId?: string | null } | undefined)
      ?.activeOrganizationId ?? null;
  const sessionUserId = data?.user?.id ?? null;
  const activeOrganizationId = isSigningOut
    ? null
    : (pendingOrganizationId ?? sessionActiveOrganizationId);

  React.useEffect(() => {
    if (!sessionUserId) return;
    if (!sessionActiveOrganizationId) return;
    setLastActiveOrganizationId(sessionUserId, sessionActiveOrganizationId);
  }, [sessionActiveOrganizationId, sessionUserId]);

  const refreshSession = React.useCallback(async () => {
    await refetch({
      query: {
        disableCookieCache: true,
      },
    });
  }, [refetch]);

  const signOut = React.useCallback(async () => {
    setIsSigningOut(true);
    await Promise.all([
      queryClient.cancelQueries({ queryKey: ["app"] }),
      queryClient.cancelQueries({ queryKey: ["auth"] }),
    ]);

    try {
      const result = await authClient.signOut();

      if (result.error) {
        throw new Error(result.error.message || "Unable to sign out");
      }

      setPendingOrganizationId(null);
      setIsOrganizationSwitching(false);
      queryClient.removeQueries({ queryKey: ["app"] });
      queryClient.removeQueries({ queryKey: ["auth"] });
      await refetch({
        query: {
          disableCookieCache: true,
        },
      });
    } finally {
      setIsSigningOut(false);
    }
  }, [queryClient, refetch]);

  const beginOrganizationSwitch = React.useCallback(
    (organizationId: string) => {
      setPendingOrganizationId(organizationId);
      setLastActiveOrganizationId(sessionUserId, organizationId);
      setIsOrganizationSwitching(true);
    },
    [sessionUserId]
  );

  const completeOrganizationSwitch = React.useCallback(() => {
    setPendingOrganizationId(null);
    setIsOrganizationSwitching(false);
  }, []);

  const cancelOrganizationSwitch = React.useCallback(
    (organizationId: string | null) => {
      setPendingOrganizationId(organizationId);
      if (organizationId) {
        setLastActiveOrganizationId(sessionUserId, organizationId);
      } else {
        clearLastActiveOrganizationId(sessionUserId);
      }
      setIsOrganizationSwitching(false);
    },
    [sessionUserId]
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session: data ?? null,
      user: data?.user ?? null,
      activeOrganizationId,
      isAuthenticated: Boolean(data?.user) && !isSigningOut,
      hasActiveOrganization: Boolean(activeOrganizationId),
      isSigningOut,
      isOrganizationSwitching,
      isLoading: isPending,
      isRefetching,
      refreshSession,
      beginOrganizationSwitch,
      completeOrganizationSwitch,
      cancelOrganizationSwitch,
      signOut,
    }),
    [
      data,
      activeOrganizationId,
      isSigningOut,
      isOrganizationSwitching,
      isPending,
      isRefetching,
      refreshSession,
      beginOrganizationSwitch,
      completeOrganizationSwitch,
      cancelOrganizationSwitch,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
