/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient, type AuthSession, type AuthUser } from "@/lib/auth";

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { data, isPending, isRefetching, refetch } = authClient.useSession();
  const queryClient = useQueryClient();

  const refreshSession = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  const signOut = React.useCallback(async () => {
    const result = await authClient.signOut();

    if (result.error) {
      throw new Error(result.error.message || "Unable to sign out");
    }

    queryClient.removeQueries({ queryKey: ["app"] });
    await refetch();
  }, [queryClient, refetch]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session: data ?? null,
      user: data?.user ?? null,
      isAuthenticated: Boolean(data?.user),
      isLoading: isPending,
      isRefetching,
      refreshSession,
      signOut,
    }),
    [data, isPending, isRefetching, refreshSession, signOut]
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
