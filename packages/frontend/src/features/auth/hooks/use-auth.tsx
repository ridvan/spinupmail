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
  const [isOrganizationSwitching, setIsOrganizationSwitching] =
    React.useState(false);
  const [pendingOrganizationId, setPendingOrganizationId] = React.useState<
    string | null
  >(null);
  const sessionActiveOrganizationId =
    (data?.session as { activeOrganizationId?: string | null } | undefined)
      ?.activeOrganizationId ?? null;
  const activeOrganizationId =
    pendingOrganizationId ?? sessionActiveOrganizationId;

  React.useEffect(() => {
    if (!sessionActiveOrganizationId) return;
    setLastActiveOrganizationId(sessionActiveOrganizationId);
  }, [sessionActiveOrganizationId]);

  React.useEffect(() => {
    if (!pendingOrganizationId) return;
    if (sessionActiveOrganizationId !== pendingOrganizationId) return;
    setPendingOrganizationId(null);
  }, [pendingOrganizationId, sessionActiveOrganizationId]);

  const refreshSession = React.useCallback(async () => {
    await refetch({
      query: {
        disableCookieCache: true,
      },
    });
  }, [refetch]);

  const signOut = React.useCallback(async () => {
    const result = await authClient.signOut();

    if (result.error) {
      throw new Error(result.error.message || "Unable to sign out");
    }

    queryClient.removeQueries({ queryKey: ["app"] });
    setPendingOrganizationId(null);
    setIsOrganizationSwitching(false);
    clearLastActiveOrganizationId();
    await refetch({
      query: {
        disableCookieCache: true,
      },
    });
  }, [queryClient, refetch]);

  const beginOrganizationSwitch = React.useCallback(
    (organizationId: string) => {
      setPendingOrganizationId(organizationId);
      setLastActiveOrganizationId(organizationId);
      setIsOrganizationSwitching(true);
    },
    []
  );

  const completeOrganizationSwitch = React.useCallback(() => {
    setIsOrganizationSwitching(false);
  }, []);

  const cancelOrganizationSwitch = React.useCallback(
    (organizationId: string | null) => {
      setPendingOrganizationId(organizationId);
      if (organizationId) {
        setLastActiveOrganizationId(organizationId);
      } else {
        clearLastActiveOrganizationId();
      }
      setIsOrganizationSwitching(false);
    },
    []
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session: data ?? null,
      user: data?.user ?? null,
      activeOrganizationId,
      isAuthenticated: Boolean(data?.user),
      hasActiveOrganization: Boolean(activeOrganizationId),
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
